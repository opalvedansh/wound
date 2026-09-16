"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "../../../lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Activity } from "lucide-react";
import { motion } from "motion/react";

// Accounts are invite-only: there is no self-signup.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <Card className="border-black/5 dark:border-white/5 shadow-2xl relative overflow-hidden">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">ClearAligner</CardTitle>
            <CardDescription>Clinical Portal Access</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <form className="space-y-4" onSubmit={handleSignIn}>
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                  placeholder="doctor@clinic.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button type="submit" className="w-full rounded-full h-11" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Need an account? Ask your clinic administrator for an invitation.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

