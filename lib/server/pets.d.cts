import type { PetArchive } from '../db/archive-types';
export function listPets(userId: string): Promise<PetArchive[]>;
export function ownedPet(userId: string, id: string): Promise<{ archive: PetArchive; version: number }>;
export function insertPet(archive: PetArchive): Promise<void>;
export function updatePet(userId: string, id: string, version: number, archive: PetArchive): Promise<void>;
export function deletePet(userId: string, id: string): Promise<PetArchive>;
export function ownsVideo(userId: string, url: string): Promise<boolean>;
export function ownsImage(userId: string, url: string): Promise<boolean>;
