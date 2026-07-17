/**
 * utils/atomicWrite.ts — 原子写入工具
 *
 * 写入流程：先写 .tmp 临时文件，确认后 rename 为目标文件。
 * 如果写入过程中被强杀，下次启动时可从 .tmp 恢复。
 *
 * 使用 Obsidian Vault API（不依赖 Node.js fs）。
 */

import { App, TFile, TFolder, TAbstractFile } from 'obsidian';

/**
 * 原子写入文件内容
 *
 * 流程：
 * 1. 写入 {filePath}.tmp
 * 2. 删除目标文件（如果存在）
 * 3. 重命名 .tmp → 目标文件
 *
 * 如果任何步骤失败，.tmp 文件会保留，下次启动时可恢复。
 *
 * @param vault Obsidian Vault 实例
 * @param filePath 目标文件路径
 * @param data 要写入的内容
 */
export async function atomicWrite(
  vault: App['vault'],
  filePath: string,
  data: string,
): Promise<void> {
  const tmpPath = filePath + '.tmp';

  // 确保父目录存在
  const parts = filePath.split('/');
  const dirPath = parts.slice(0, -1).join('/');
  if (dirPath) {
    await ensureDirectory(vault, dirPath);
  }

  // 步骤 1：写入 .tmp 文件
  const existingTmp = vault.getAbstractFileByPath(tmpPath);
  if (existingTmp instanceof TFile) {
    await vault.modify(existingTmp, data);
  } else {
    await vault.create(tmpPath, data);
  }

  // 步骤 2：删除目标文件（如果存在）
  const existingTarget = vault.getAbstractFileByPath(filePath);
  if (existingTarget) {
    await vault.delete(existingTarget);
  }

  // 步骤 3：重命名 .tmp → 目标文件
  const tmpFile = vault.getAbstractFileByPath(tmpPath);
  if (tmpFile instanceof TFile) {
    await vault.rename(tmpFile, filePath);
  }
}

/**
 * 确保目录存在（递归创建）
 */
async function ensureDirectory(vault: App['vault'], dirPath: string): Promise<void> {
  const existing = vault.getAbstractFileByPath(dirPath);
  if (existing) return;

  // 确保父目录先存在
  const parts = dirPath.split('/');
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join('/');
    await ensureDirectory(vault, parentPath);
  }

  await vault.createFolder(dirPath);
}

/**
 * 读取文件内容（安全版本，不存在则返回 null）
 */
export async function safeRead(
  vault: App['vault'],
  filePath: string,
): Promise<string | null> {
  try {
    const file = vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      return await vault.read(file);
    }
  } catch {
    // 文件不存在或读取失败
  }
  return null;
}

/**
 * 检查并恢复 .tmp 文件
 *
 * 在插件启动时调用：如果 .tmp 文件存在，说明上次写入被中断，
 * 将 .tmp 重命名为目标文件。
 *
 * @param vault Obsidian Vault 实例
 * @param filePath 目标文件路径
 */
export async function recoverFromTmp(
  vault: App['vault'],
  filePath: string,
): Promise<boolean> {
  const tmpPath = filePath + '.tmp';
  const tmpFile = vault.getAbstractFileByPath(tmpPath);

  if (!(tmpFile instanceof TFile)) {
    return false; // 没有 .tmp 文件需要恢复
  }

  try {
    // .tmp 文件存在，尝试恢复
    const existingTarget = vault.getAbstractFileByPath(filePath);
    if (existingTarget) {
      await vault.delete(existingTarget);
    }
    await vault.rename(tmpFile, filePath);
    console.log(`[AtomicWrite] Recovered ${filePath} from .tmp`);
    return true;
  } catch (e) {
    console.error(`[AtomicWrite] Failed to recover ${filePath}:`, e);
    return false;
  }
}

/**
 * 写入后复制为 .bak 备份
 *
 * 在每次成功写入后调用，保留上一次的版本。
 *
 * @param vault Obsidian Vault 实例
 * @param filePath 目标文件路径
 */
export async function createBackup(
  vault: App['vault'],
  filePath: string,
): Promise<void> {
  const bakPath = filePath + '.bak';
  const file = vault.getAbstractFileByPath(filePath);

  if (!(file instanceof TFile)) return;

  try {
    const content = await vault.read(file);
    const existingBak = vault.getAbstractFileByPath(bakPath);
    if (existingBak instanceof TFile) {
      await vault.modify(existingBak, content);
    } else {
      await vault.create(bakPath, content);
    }
  } catch (e) {
    console.warn(`[AtomicWrite] Failed to create backup for ${filePath}:`, e);
  }
}

/**
 * 从 .bak 恢复文件
 *
 * @param vault Obsidian Vault 实例
 * @param filePath 目标文件路径
 * @returns 是否恢复成功
 */
export async function restoreFromBackup(
  vault: App['vault'],
  filePath: string,
): Promise<boolean> {
  const bakPath = filePath + '.bak';
  const bakFile = vault.getAbstractFileByPath(bakPath);

  if (!(bakFile instanceof TFile)) {
    return false; // 没有备份
  }

  try {
    const content = await vault.read(bakFile);
    // 验证 JSON 格式
    JSON.parse(content);

    const existingTarget = vault.getAbstractFileByPath(filePath);
    if (existingTarget instanceof TFile) {
      await vault.modify(existingTarget, content);
    } else {
      await vault.create(filePath, content);
    }
    console.log(`[AtomicWrite] Restored ${filePath} from backup`);
    return true;
  } catch (e) {
    console.error(`[AtomicWrite] Failed to restore from backup:`, e);
    return false;
  }
}
