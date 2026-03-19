import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { queryClientInstance } from "@/lib/query-client";
import { pagesConfig } from "./pages.config";
import PageNotFound from "./lib/PageNotFound";
import CardManager from "./pages/CardManager";
import Connections from "./pages/Connections";
import { LicenseProvider } from "@/components/licensing/LicenseProvider";
import LicenseGate from "@/components/licensing/LicenseGate";

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

const AppRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      }
    />
    {Object.entries(Pages).map(([path, Page]) => (
      <Route
        key={path}
        path={`/${path}`}
        element={
          <LayoutWrapper currentPageName={path}>
            <Page />
          </LayoutWrapper>
        }
      />
    ))}
    <Route path="/CardManager" element={<CardManager />} />
    <Route path="/Connections" element={<Connections />} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <LicenseProvider>
      <LicenseGate>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </LicenseGate>
    </LicenseProvider>
  );
}

export default App;
