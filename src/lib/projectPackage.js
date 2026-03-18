import { base44 } from "@/api/base44Client";

const PACKAGE_FORMAT = "bingovoice-project-package";
const PACKAGE_VERSION = 1;

const SETTINGS_ASSET_FIELDS = [
  "background_music_url",
  "bonus_audio_url",
  "bonus_video_url",
  "wheel_audio_url",
  "panariello_band_video_url",
  "waiting_video_url",
];

const fileNameFromUrl = (url, fallback) => {
  try {
    if (url.startsWith("data:")) {
      return fallback;
    }
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").pop();
    return name || fallback;
  } catch {
    return fallback;
  }
};

const guessMimeType = (url, blob) => blob?.type || (url.startsWith("data:") ? url.slice(5, url.indexOf(";")) : "application/octet-stream");

const blobToBase64 = async (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Impossibile convertire il file"));
    reader.readAsDataURL(blob);
  });

const fetchAsset = async (url, fallbackName) => {
  if (!url) return null;
  const response = await fetch(url);
  const blob = await response.blob();
  return {
    name: fileNameFromUrl(url, fallbackName),
    type: guessMimeType(url, blob),
    data: await blobToBase64(blob),
  };
};

const pushAsset = async (assets, url, fallbackName) => {
  const asset = await fetchAsset(url, fallbackName);
  if (!asset) return "";
  const key = `${crypto.randomUUID()}`;
  assets[key] = asset;
  return key;
};

const createFileFromAsset = (asset) => {
  const bytes = Uint8Array.from(atob(asset.data), (char) => char.charCodeAt(0));
  return new File([bytes], asset.name, { type: asset.type || "application/octet-stream" });
};

const uploadAsset = async (asset) => {
  if (!asset) return "";
  const result = await base44.integrations.Core.UploadFile({
    file: createFileFromAsset(asset),
  });
  return result.file_url;
};

export async function buildProjectPackage({
  project,
  mediaItems,
  playerCards,
  appSettings,
  videoButtons,
}) {
  const assets = {};
  const projectImageAssetKey = await pushAsset(assets, project.image_url, "project-image");

  const packagedMedia = [];
  for (const item of mediaItems) {
    const imageAssetKey = await pushAsset(assets, item.image_url, `${item.name}-image`);
    const audioAssetKey = await pushAsset(assets, item.audio_url, `${item.name}-audio`);
    packagedMedia.push({
      sourceId: item.id,
      name: item.name,
      extracted: false,
      is_bonus: Boolean(item.is_bonus),
      is_panariello_band: Boolean(item.is_panariello_band),
      imageAssetKey,
      audioAssetKey,
    });
  }

  const packagedCards = playerCards.map((card) => ({
    card_number: card.card_number,
    mediaSourceIds: Array.isArray(card.media_item_ids) ? card.media_item_ids : [],
  }));

  const packagedSettings = appSettings
    ? {
        music_volume: appSettings.music_volume ?? 0.8,
      }
    : null;

  if (packagedSettings) {
    for (const field of SETTINGS_ASSET_FIELDS) {
      packagedSettings[field] = await pushAsset(assets, appSettings[field], field);
    }
  }

  const packagedButtons = [];
  for (const button of videoButtons) {
    packagedButtons.push({
      label: button.label,
      color: button.color || "",
      videoAssetKey: await pushAsset(assets, button.video_url, `${button.label}-video`),
    });
  }

  return {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description || "",
      imageAssetKey: projectImageAssetKey,
    },
    mediaItems: packagedMedia,
    playerCards: packagedCards,
    appSettings: packagedSettings,
    videoButtons: packagedButtons,
    assets,
  };
}

export async function importProjectPackage(pkg) {
  if (pkg?.format !== PACKAGE_FORMAT) {
    throw new Error("Pacchetto progetto non valido");
  }

  const assets = pkg.assets || {};
  const existingProjects = await base44.entities.Project.list("-created_date");
  const existingNameSet = new Set(existingProjects.map((project) => project.name?.trim().toLowerCase()).filter(Boolean));
  let projectName = pkg.project?.name?.trim() || "Progetto importato";
  if (existingNameSet.has(projectName.toLowerCase())) {
    projectName = `${projectName} (Importato ${new Date().toLocaleDateString("it-IT")})`;
  }

  const projectImageUrl = await uploadAsset(assets[pkg.project?.imageAssetKey]);
  const createdProject = await base44.entities.Project.create({
    name: projectName,
    description: pkg.project?.description || "",
    image_url: projectImageUrl,
  });

  const mediaIdMap = new Map();
  for (const item of pkg.mediaItems || []) {
    const created = await base44.entities.MediaItem.create({
      name: item.name,
      image_url: await uploadAsset(assets[item.imageAssetKey]),
      audio_url: await uploadAsset(assets[item.audioAssetKey]),
      extracted: false,
      is_bonus: Boolean(item.is_bonus),
      is_panariello_band: Boolean(item.is_panariello_band),
      project_id: createdProject.id,
    });
    mediaIdMap.set(item.sourceId, created.id);
  }

  for (const card of pkg.playerCards || []) {
    await base44.entities.PlayerCard.create({
      card_number: card.card_number,
      media_item_ids: (card.mediaSourceIds || []).map((id) => mediaIdMap.get(id)).filter(Boolean),
      project_id: createdProject.id,
    });
  }

  if (pkg.appSettings) {
    const existingSettings = await base44.entities.AppSettings.list();
    const nextSettings = {
      music_volume: pkg.appSettings.music_volume ?? 0.8,
    };
    for (const field of SETTINGS_ASSET_FIELDS) {
      nextSettings[field] = await uploadAsset(assets[pkg.appSettings[field]]);
    }

    if (existingSettings[0]) {
      await base44.entities.AppSettings.update(existingSettings[0].id, nextSettings);
    } else {
      await base44.entities.AppSettings.create(nextSettings);
    }
  }

  for (const button of pkg.videoButtons || []) {
    await base44.entities.VideoButton.create({
      label: button.label,
      color: button.color || "",
      video_url: await uploadAsset(assets[button.videoAssetKey]),
    });
  }

  return createdProject;
}
