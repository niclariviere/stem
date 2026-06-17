import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ComponentType } from "react";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import MatchEngine from "./pages/MatchEngine";
import StemLibrary from "./pages/StemLibrary";
import StemUpload from "./pages/StemUpload";
import WalletSetup from "./pages/WalletSetup";
import Songs from "./pages/Songs";
import Newsfeed from "./pages/Newsfeed";
import BugReport from "./pages/BugReport";
import Users from "./pages/Users";

// Internal (logged-in) pages render inside the dashboard nav; public pages don't.
const withDash = (Page: ComponentType) => () => (
  <DashboardLayout>
    <Page />
  </DashboardLayout>
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={withDash(Profile)} />
      <Route path="/edit" component={withDash(EditProfile)} />
      <Route path="/match" component={withDash(MatchEngine)} />
      <Route path="/library" component={withDash(StemLibrary)} />
      <Route path="/upload" component={withDash(StemUpload)} />
      <Route path="/wallet-setup" component={withDash(WalletSetup)} />
      <Route path="/songs" component={withDash(Songs)} />
      <Route path="/feed" component={withDash(Newsfeed)} />
      <Route path="/report" component={withDash(BugReport)} />
      <Route path="/users" component={withDash(Users)} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
