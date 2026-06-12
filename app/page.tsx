// Step 1：产品心智重命名。
// 旧路径 "/" 已经迁移到 "/create"，这里直接 server-side 跳转，不留死链。
import { redirect } from "next/navigation";
export default function LegacyHomePage() {
  redirect("/create");
}
