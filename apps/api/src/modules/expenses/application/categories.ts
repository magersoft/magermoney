import { err, ok, type Result } from 'neverthrow';
import type {
  ExpenseCategoryDto,
  ExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { ExpenseCategoryPatch } from './category-repository.js';
import { toCategoryDto } from './dto.js';

type CategoryRepos = Pick<Repos, 'expenseCategories'>;

const nameTaken = () =>
  new ConflictError('category_name_taken', 'A category with this name already exists');

export const listCategories =
  (repos: CategoryRepos) =>
  async (userId: string): Promise<ExpenseCategoryDto[]> =>
    (await repos.expenseCategories.list(userId)).map(toCategoryDto);

export const createCategory =
  (repos: CategoryRepos) =>
  async (
    userId: string,
    input: ExpenseCategoryInput,
  ): Promise<Result<ExpenseCategoryDto, ConflictError>> => {
    const sortOrder = input.sortOrder ?? (await repos.expenseCategories.list(userId)).length;
    const row = await repos.expenseCategories.insert(userId, {
      name: input.name.trim(),
      icon: input.icon ?? null,
      sortOrder,
    });
    return row === 'name_taken' ? err(nameTaken()) : ok(toCategoryDto(row));
  };

export const updateCategory =
  (repos: CategoryRepos) =>
  async (
    userId: string,
    id: string,
    input: UpdateExpenseCategoryInput,
  ): Promise<Result<ExpenseCategoryDto, NotFoundError | ConflictError>> => {
    const patch: ExpenseCategoryPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    const row = await repos.expenseCategories.update(userId, id, patch);
    if (row === null) return err(new NotFoundError('category'));
    return row === 'name_taken' ? err(nameTaken()) : ok(toCategoryDto(row));
  };

export const deleteCategory =
  (repos: CategoryRepos) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const outcome = await repos.expenseCategories.delete(userId, id);
    if (outcome === 'not_found') return err(new NotFoundError('category'));
    if (outcome === 'has_expenses')
      return err(
        new ConflictError(
          'category_has_expenses',
          'Move or delete the expenses of this category first',
        ),
      );
    return ok(undefined);
  };
