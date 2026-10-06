// Tela de login do INSIGHT (e-mail + senha do Supabase Auth, as mesmas da plataforma).
// Também cobre o caso "logado, mas sem permissão" (sem_acesso).
"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

/** Alternador claro/noturno no canto da tela (o header do app ainda não existe aqui). */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);

  // Evita mismatch de hidratação: no server não sabemos a preferência salva.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMontado(true), []);

  const escuro = montado && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="absolute top-4 right-4 z-10 rounded-full border-black/10 bg-white/60 text-brand-navy backdrop-blur-sm hover:bg-white/80 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label="Alternar tema claro/noturno"
    >
      {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {escuro ? "Claro" : "Noturno"}
    </Button>
  );
}

export function LoginScreen() {
  const { estado, entrar, sair } = useAuth();
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [entrando, setEntrando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#dbeafe] via-[#d3f1f0] to-[#c9f5e3] px-4 py-10 dark:from-[#001c6b] dark:via-[#05407a] dark:to-[#0a6b5c]">
      {/* Brilhos suaves por cima do degradê, só pra dar profundidade. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-brand-blue/20 blur-3xl dark:bg-brand-blue/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-brand-green/25 blur-3xl dark:bg-brand-green/20"
      />

      <ThemeToggle />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/60 bg-card/90 p-6 text-card-foreground shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-card/85">
        <div className="mb-6 flex justify-center rounded-xl bg-brand-navy p-4">
          <Image
            src="/logo-insight.png"
            alt="INSIGHT — Grupo ROMABC x Green+"
            width={1672}
            height={941}
            className="h-auto w-48"
            priority
          />
        </div>

        {estado.status === "sem_acesso" ? (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <h1 className="text-lg font-semibold text-heading">Sem acesso ao INSIGHT</h1>
              <p className="mt-1 text-muted-foreground">
                {estado.email ? <strong className="text-foreground">{estado.email}</strong> : "Esta conta"}{" "}
                está logada, mas não tem permissão para usar o INSIGHT. O acesso é restrito às
                consultoras e administradores. Fale com o administrador se isso for um engano.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void sair()}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-semibold text-heading">Entrar</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Use o mesmo e-mail e a mesma senha da plataforma.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={entrando}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={entrando}
              />
            </div>

            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              disabled={entrando || !email || !senha}
              className="rounded-full border-none bg-gradient-to-r from-brand-blue to-brand-green text-white hover:brightness-110"
            >
              {entrando && <Loader2 className="size-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
