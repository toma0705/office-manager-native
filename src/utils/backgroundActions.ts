import { createUsersApi } from "@/api/client";
import { tokenStorage } from "@/storage/tokenStorage";

export async function handleEnterAction() {
  try {
    const token = await tokenStorage.get();
    if (!token) {
      console.log("No token found for background action");
      return;
    }

    const api = createUsersApi(token);
    // まず自分のIDを取得
    const me = await api.usersMeGet();

    // 入室APIを叩く
    await api.usersIdEnterPost({ id: me.id });
    console.log("Successfully entered via background action");
  } catch (error) {
    console.error("Failed to enter via background action:", error);
  }
}

export async function handleExitAction() {
  try {
    const token = await tokenStorage.get();
    if (!token) {
      console.log("No token found for background action");
      return;
    }

    const api = createUsersApi(token);
    // まず自分のIDを取得
    const me = await api.usersMeGet();

    // 退室APIを叩く
    await api.usersIdExitPost({ id: me.id });
    console.log("Successfully exited via background action");
  } catch (error) {
    console.error("Failed to exit via background action:", error);
  }
}
