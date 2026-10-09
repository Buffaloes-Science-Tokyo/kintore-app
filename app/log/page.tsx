import { redirect } from "next/navigation";

// 旧URL（ブックマーク等）の互換用: 「記録する」はホームに移動した
export default function LogRedirect() {
  redirect("/");
}
