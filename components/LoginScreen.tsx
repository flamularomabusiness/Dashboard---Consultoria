// Tela de entrada do INSIGHT (e-mail + senha do Supabase Auth, as mesmas da plataforma).
// Cobre também: criar conta (só emails liberados pelo administrador conseguem) e os casos
// "logado, mas sem permissão" (sem_acesso) e "não deu para verificar a permissão" (erro_acesso).
// Nenhuma tela de dados é montada enquanto o usuário não está autorizado (ver AppShell).
"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { nomeCompletoValido, normalizarNomeCompleto } from "@/lib/erros-auth";

const SENHA_MINIMA = 6;

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

type Modo = "entrar" | "criar";

export function LoginScreen() {
  const { estado, entrar, criarConta, verificarAcesso, sair } = useAuth();
  const [modo, setModo] = React.useState<Modo>("entrar");
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  const criando = modo === "criar";
  const nomeOk = nomeCompletoValido(nome);
  const senhaOk = senha.length >= SENHA_MINIMA;
  const podeEnviar = criando ? nomeOk && email !== "" && senhaOk : email !== "" && senha !== "";

  function trocarModo(proximo: Modo) {
    setModo(proximo);
    setErro(null);
    setAviso(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      if (criando) {
        const { precisaConfirmar } = await criarConta(normalizarNomeCompleto(nome), email, senha);
        if (precisaConfirmar) {
          // Sem sessão ainda: o Supabase mandou um email de confirmação.
          setSenha("");
          setModo("entrar");
          setAviso("Conta criada! Confirme seu email pelo link que enviamos e depois entre.");
        }
        // Com sessão, o AuthProvider assume e a tela troca sozinha.
      } else {
        await entrar(email, senha);
      }
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : criando
            ? "Não foi possível criar a conta."
            : "Não foi possível entrar.",
      );
    } finally {
      setEnviando(false);
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
              <h1 className="text-lg font-semibold text-heading">
                Seu usuário não tem acesso ao Dashboard de ATAs
              </h1>
              <p className="mt-1 text-muted-foreground">
                {estado.email ? (
                  <strong className="text-foreground">{estado.email}</strong>
                ) : (
                  "Esta conta"
                )}{" "}
                está logada, mas não tem permissão para usar o dashboard. O acesso é restrito às
                consultoras e administradores. Fale com o administrador se isso for um engano.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void sair()}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        ) : estado.status === "erro_acesso" ? (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <h1 className="text-lg font-semibold text-heading">
                Não foi possível verificar seu acesso
              </h1>
              <p className="mt-1 text-muted-foreground">
                Houve uma falha ao consultar suas permissões. Tente novamente em instantes.
              </p>
            </div>
            <Button type="button" onClick={() => void verificarAcesso()}>
              Tentar novamente
            </Button>
            <Button type="button" variant="outline" onClick={() => void sair()}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-semibold text-heading">
                {criando ? "Criar conta" : "Entrar"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {criando
                  ? "Só emails liberados pelo administrador conseguem criar conta."
                  : "Use o mesmo e-mail e a mesma senha da plataforma."}
              </p>
            </div>

            {criando && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-nome">Nome completo</Label>
                <Input
                  id="login-nome"
                  type="text"
                  autoComplete="name"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={enviando}
                  aria-invalid={nome !== "" && !nomeOk}
                />
                {nome !== "" && !nomeOk && (
                  <p className="text-xs text-destructive">Informe o nome completo (mínimo de 3 letras).</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                type="password"
                autoComplete={criando ? "new-password" : "current-password"}
                required
                minLength={criando ? SENHA_MINIMA : undefined}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={enviando}
              />
              {criando && (
                <p className="text-xs text-muted-foreground">Mínimo de {SENHA_MINIMA} caracteres.</p>
              )}
            </div>

            {aviso && (
              <p role="status" className="text-sm text-brand-green-alt dark:text-brand-green">
                {aviso}
              </p>
            )}
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              disabled={enviando || !podeEnviar}
              className="rounded-full border-none bg-gradient-to-r from-brand-blue to-brand-green text-white hover:brightness-110"
            >
              {enviando && <Loader2 className="size-4 animate-spin" />}
              {criando ? "Criar conta" : "Entrar"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {criando ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => trocarModo(criando ? "entrar" : "criar")}
                disabled={enviando}
                className="font-medium text-brand-blue underline-offset-4 hover:underline dark:text-brand-green"
              >
                {criando ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
