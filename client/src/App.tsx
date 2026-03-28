import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={Profile} />
      <Route path="/edit" component={EditProfile} />
      <Route path="/match" component={MatchEngine} />
      <Route path="/library" component={StemLibrary} />
      <Route path="/upload" component={StemUpload} />
      <Route path="/wallet-setup" component={WalletSetup} />
      <Route path="/songs" component={Songs} />
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
