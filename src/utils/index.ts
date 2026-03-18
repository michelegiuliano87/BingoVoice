export function createPageUrl(pageName: string) {
    if (typeof window === "undefined") {
        return `#/${pageName.replace(/ /g, "-")}`;
    }

    const url = new URL(window.location.href);
    url.hash = `/${pageName.replace(/ /g, "-")}`;
    return url.toString();
}
