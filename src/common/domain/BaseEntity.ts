export abstract class BaseEntity {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(id?: string) {
    if (id) {
      this.id = id;
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
