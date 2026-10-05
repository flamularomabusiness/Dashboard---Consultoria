import { redirect } from "next/navigation";

// O dashboard de reuniões vive na raiz ("/"); este atalho mantém o link /reunioes funcionando.
export default function ReunioesPage() {
  redirect("/");
}
