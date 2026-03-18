import React from "react";

export default function Layout({ children, currentPageName }) {
  // ProjectionScreen should be fullscreen with no layout
  if (currentPageName === "ProjectionScreen") {
    return <>{children}</>;
  }

  return <>{children}</>;
}