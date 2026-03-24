/**
 * Interface cho UnitOfWork pattern
 * Cho phép chạy logic nghiệp vụ trong transaction
 */
export interface IUnitOfWork {
  /**
   * Chạy logic trong transaction
   * @param work Hàm callback chứa logic nghiệp vụ
   * @returns Kết quả trả về từ hàm work
   */
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
