// Tela de login do INSIGHT (e-mail + senha do Supabase Auth, as mesmas da plataforma).
// Também cobre o caso "logado, mas sem permissão" (sem_acesso).
"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

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
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 text-card-foreground shadow-xl">
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
