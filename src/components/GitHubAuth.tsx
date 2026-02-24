"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

interface User {
  name: string;
  email: string;
  avatar: string;
}

export function GitHubAuth({ onAuth }: { onAuth: (user: User | null) => void }) {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = () => {
    const mockUser = {
      name: "GitHub User",
      email: "user@github.com",
      avatar: "https://picsum.photos/seed/user/100/100"
    };
    setUser(mockUser);
    onAuth(mockUser);
  };

  const handleLogout = () => {
    setUser(null);
    onAuth(null);
  };

  return (
    <div className="flex justify-center mb-8">
      {!user ? (
        <Button onClick={handleLogin} variant="outline" className="gap-2">
          <Github className="w-4 h-4" />
          Masuk dengan GitHub
        </Button>
      ) : (
        <div className="flex items-center gap-4 p-2 pl-4 border rounded-full bg-white shadow-sm">
          <span className="text-sm font-medium">Halo, {user.name}</span>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="rounded-full text-xs">
            Keluar
          </Button>
        </div>
      )}
    </div>
  );
}
