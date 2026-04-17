import argon2 from "argon2";

export class Admin {
  private id: string;
  private password: string;

  constructor(id: string, password: string) {
    this.id = id;
    this.password = password;
  }

  getPassword(): string {
    return this.password;
  }

  async setPassword(password: string): Promise<void> {
    const hashedPassword = await argon2.hash(password);
    this.password = hashedPassword;
  }

  async verifyPassword(password: string): Promise<boolean> {
    return await argon2.verify(this.password, password);
  }
}
