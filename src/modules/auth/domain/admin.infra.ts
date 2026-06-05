export interface IAdminInfrastructure {
    verifyPassword(password: string): Promise<boolean>;
}