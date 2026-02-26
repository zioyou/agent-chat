import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

interface UserSecrets {
  kakao_client_id?: string;
  kakao_access_token?: string;
  kakao_refresh_token?: string;
  slack_webhook_url?: string;
  gmail_id?: string;
  gmail_app_password?: string;
  google_client_id?: string;
  google_client_secret?: string;
  google_refresh_token?: string;
}

export function SettingsDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [secrets, setSecrets] = useState<UserSecrets>({});

  useEffect(() => {
    if (open) {
      // Load secrets from localStorage when dialog opens
      const stored = localStorage.getItem("agent_user_secrets");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSecrets(parsed);
        } catch (e) {
          console.error("Failed to parse user secrets", e);
        }
      }
    }

    // Listener for Google OAuth Popups
    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
            const { refresh_token, access_token, client_id, client_secret } = event.data.data;
            setSecrets((prev) => ({
                ...prev,
                google_refresh_token: refresh_token,
                google_client_id: client_id,
                google_client_secret: client_secret
            }));
            toast.success("Google Account Connected!");
        }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open]);

  const handleSave = () => {
    localStorage.setItem("agent_user_secrets", JSON.stringify(secrets));
    toast.success("Settings saved.", {
      description: "Credentials are saved locally and sent securely only with agent requests."
    });
    setOpen(false);
  };

  const handleChange = (key: keyof UserSecrets, value: string) => {
    setSecrets((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" title="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent Tool Settings</DialogTitle>
          <DialogDescription>
            에이전트가 사용할 외부 서비스의 자격 증명을 입력해주세요.
            <br />
            이 정보는 브라우저(Local Storage)에만 저장됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* KakaoTalk */}
          <div className="space-y-2">
            <h4 className="font-medium leading-none">KakaoTalk</h4>
            <p className="text-xs text-muted-foreground mb-2">
              토큰 갱신을 위해 REST API Key와 Refresh Token이 필요합니다.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="kakao_client_id">REST API Key (Client ID)</Label>
              <PasswordInput
                id="kakao_client_id"
                value={secrets.kakao_client_id || ""}
                onChange={(e) => handleChange("kakao_client_id", e.target.value)}
                placeholder="Kakao Developers REST API Key"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kakao_access_token">Access Token</Label>
              <PasswordInput
                id="kakao_access_token"
                value={secrets.kakao_access_token || ""}
                onChange={(e) => handleChange("kakao_access_token", e.target.value)}
                placeholder="Initial Access Token"
              />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="kakao_refresh_token">Refresh Token</Label>
              <PasswordInput
                id="kakao_refresh_token"
                value={secrets.kakao_refresh_token || ""}
                onChange={(e) => handleChange("kakao_refresh_token", e.target.value)}
                placeholder="Refresh Token for auto-renewal"
              />
            </div>
          </div>



          {/* Google Calendar / Gmail (OAuth) */}
          <div className="space-y-4 pt-4 border-t">
             <h4 className="font-medium leading-none">Google Service (Calendar/Gmail)</h4>
             <p className="text-xs text-muted-foreground mb-2">
              Google 계정 연결 (Calendar, Gmail)
            </p>
            
            <div className="flex flex-col gap-2">
                <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full flex gap-2 items-center justify-center bg-white text-black border-gray-300 hover:bg-gray-50"
                    onClick={() => {
                        const width = 500;
                        const height = 600;
                        const left = window.screen.width / 2 - width / 2;
                        const top = window.screen.height / 2 - height / 2;
                        window.open(
                            "http://localhost:8002/auth/google/login",
                            "Google Login",
                            `width=${width},height=${height},top=${top},left=${left}`
                        );
                    }}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Connect Google Account
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                    * 팝업이 차단된 경우 허용해주세요.
                </p>
            </div>
            
            {/* Advanced Settings (Hidden by default or smaller) */}
            <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer mb-2">Advanced / Manual Setup</summary>
                <div className="grid gap-2 pl-2 border-l-2">
                    <div className="grid gap-2">
                    <Label htmlFor="google_client_id">Client ID</Label>
                    <Input
                        id="google_client_id"
                        value={secrets.google_client_id || ""}
                        onChange={(e) => handleChange("google_client_id", e.target.value)}
                        placeholder="apps.googleusercontent.com"
                    />
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="google_client_secret">Client Secret</Label>
                    <PasswordInput
                        id="google_client_secret"
                        value={secrets.google_client_secret || ""}
                        onChange={(e) => handleChange("google_client_secret", e.target.value)}
                        placeholder="Client Secret"
                    />
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="google_refresh_token">Refresh Token</Label>
                    <PasswordInput
                        id="google_refresh_token"
                        value={secrets.google_refresh_token || ""}
                        onChange={(e) => handleChange("google_refresh_token", e.target.value)}
                        placeholder="1//..."
                    />
                    </div>
                </div>
            </details>
          </div>
        </div>
          
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
