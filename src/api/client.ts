/**
 * API クライアント（office-manager-api-client。web の OpenAPI 仕様から自動生成）を作る。
 * トークンを渡すと、認証が必要な API に Authorization ヘッダーを付ける。
 */
import {
  AttendanceApi,
  Configuration,
  OfficesApi,
  UsersApi,
} from "@office-manager/api-client";
import { API_BASE_URL } from "@/constants/config";

const createConfiguration = (token?: string) =>
  new Configuration({
    basePath: API_BASE_URL,
    accessToken: token ? async () => token : undefined,
  });

export const createUsersApi = (token?: string) =>
  new UsersApi(createConfiguration(token));
export const createOfficesApi = (token?: string) =>
  new OfficesApi(createConfiguration(token));
export const createAttendanceApi = (token?: string) =>
  new AttendanceApi(createConfiguration(token));
