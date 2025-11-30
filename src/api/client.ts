import {
  Configuration,
  MaintenanceApi,
  NotificationsApi,
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
export const createNotificationsApi = (token?: string) =>
  new NotificationsApi(createConfiguration(token));
export const createMaintenanceApi = (token?: string) =>
  new MaintenanceApi(createConfiguration(token));
