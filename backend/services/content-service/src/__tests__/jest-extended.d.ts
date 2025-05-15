/**
 * Type declarations to extend Jest functionality
 */

import 'jest';

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any[]> {
      mockReturnValue(value: T): this;
      mockResolvedValue(value: T): this;
      mockRejectedValue(value: any): this;
    }
  }
}
