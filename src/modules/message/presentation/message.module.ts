import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { IUnitOfWork } from "../../../infrastructure/IUnitOfWork";
import { MessageAPI } from "../api/message";
import { MessageApplication } from "../application/message.application";
import { MessageRepo } from "../infrastructure/surreal/message.repo";

export const messageModule = (pool: SurrealDbContext, uow: IUnitOfWork) => {
  const repo = new MessageRepo(pool);
  const application = new MessageApplication(repo, uow);
  const messageApi = new MessageAPI(application);
  return {
    messageApi,
    application,
    repo,
  };
};
