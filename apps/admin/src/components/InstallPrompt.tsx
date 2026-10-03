import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-4 rounded-lg bg-primary p-4 text-primary-foreground shadow-lg sm:bottom-8 sm:left-auto sm:right-8 sm:w-96">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-foreground/20">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">Installer 3AS Recharge</h3>
          <p className="text-sm text-primary-foreground/80">Accédez plus rapidement à vos transactions</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleInstallClick}>
          Installer
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" onClick={handleClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </Button>
      </div>
    </div>
  );
}
