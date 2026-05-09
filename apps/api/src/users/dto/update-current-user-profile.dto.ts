import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

const PROFILE_PREFERRED_LANGUAGES = {
  SPANISH: 'es',
  ENGLISH: 'en',
} as const;

export type PreferredLanguage = (typeof PROFILE_PREFERRED_LANGUAGES)[keyof typeof PROFILE_PREFERRED_LANGUAGES];

const PROFILE_PREFERRED_LANGUAGE_VALUES = Object.values(PROFILE_PREFERRED_LANGUAGES);

export class UpdateCurrentUserProfileDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/u, { message: 'country must be an ISO alpha-2 code' })
  country!: string;

  @IsString()
  @IsNotEmpty()
  favoriteTeamId!: string;

  @IsString()
  @IsIn(PROFILE_PREFERRED_LANGUAGE_VALUES)
  preferredLanguage!: PreferredLanguage;
}
