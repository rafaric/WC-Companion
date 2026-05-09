import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, type User } from '@prisma/client';

import { AUTH_PROVIDERS } from '../auth/auth.constants';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import type { PreferredLanguage } from './dto/update-current-user-profile.dto';

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/u;

const PREFERRED_LANGUAGE_VALUES = {
  SPANISH: 'es',
  ENGLISH: 'en',
} as const;

const USER_PROFILE_SELECT = {
  id: true,
  authProvider: true,
  authSubject: true,
  email: true,
  username: true,
  country: true,
  favoriteTeamId: true,
  avatar: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true,
} as const;

const USERNAME_FALLBACK = 'user';
const EMAIL_PLACEHOLDER_DOMAIN = 'users.invalid';

export interface CurrentUserProfileView {
  id: string;
  email: string;
  username: string;
  country: string | null;
  favoriteTeamId: string | null;
  avatar: string | null;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCurrentUserProfileInput {
  country: unknown;
  favoriteTeamId: unknown;
  preferredLanguage: unknown;
}

interface NormalizedCurrentUserProfileInput {
  country: string;
  favoriteTeamId: string;
  preferredLanguage: PreferredLanguage;
}

interface StoredUserRecord extends User {
  authProvider: string;
  authSubject: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async syncAuthenticatedUser(identity: AuthenticatedIdentity): Promise<StoredUserRecord> {
    const existingUser = await this.findUserByIdentity(identity);

    if (existingUser !== null) {
      return this.updateExistingUser(existingUser, identity);
    }

    return this.createSyncedUser(identity);
  }

  async getCurrentUser(identity: AuthenticatedIdentity): Promise<CurrentUserProfileView> {
    const user = await this.syncAuthenticatedUser(identity);
    return this.toCurrentUserProfileView(user);
  }

  async updateCurrentUserProfile(
    identity: AuthenticatedIdentity,
    input: UpdateCurrentUserProfileInput,
  ): Promise<CurrentUserProfileView> {
    const user = await this.syncAuthenticatedUser(identity);
    const normalizedInput = this.normalizeCurrentUserProfileInput(input);
    const activeTournament = await this.tournamentsService.getActiveTournament();

    const favoriteTeam = await this.prisma.team.findFirst({
      where: {
        id: normalizedInput.favoriteTeamId,
        tournamentId: activeTournament.id,
      },
      select: {
        id: true,
      },
    });

    if (favoriteTeam === null) {
      throw new NotFoundException(`Favorite team ${normalizedInput.favoriteTeamId} was not found in the active tournament`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        country: normalizedInput.country,
        favoriteTeamId: favoriteTeam.id,
        preferredLanguage: normalizedInput.preferredLanguage,
      },
      select: USER_PROFILE_SELECT,
    });

    return this.toCurrentUserProfileView(updatedUser);
  }

  private async findUserByIdentity(identity: AuthenticatedIdentity): Promise<StoredUserRecord | null> {
    return this.prisma.user.findUnique({
      where: {
        authProvider_authSubject: {
          authProvider: AUTH_PROVIDERS.AUTH0,
          authSubject: identity.authSubject,
        },
      },
      select: USER_PROFILE_SELECT,
    });
  }

  private async updateExistingUser(
    user: StoredUserRecord,
    identity: AuthenticatedIdentity,
  ): Promise<StoredUserRecord> {
    const data: Prisma.UserUpdateInput = {
      email: identity.email ?? user.email,
      avatar: identity.picture ?? user.avatar,
    };

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: USER_PROFILE_SELECT,
    });
  }

  private async createSyncedUser(identity: AuthenticatedIdentity): Promise<StoredUserRecord> {
    const email = this.resolveEmail(identity);
    const avatar = identity.picture;
    const usernameBase = this.resolveUsernameBase(identity);
    const maxAttempts = 25;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const username = attempt === 0 ? usernameBase : `${usernameBase}-${attempt + 1}`;

      try {
        return await this.prisma.user.create({
          data: {
            authProvider: AUTH_PROVIDERS.AUTH0,
            authSubject: identity.authSubject,
            email,
            username,
            avatar,
          },
          select: USER_PROFILE_SELECT,
        });
      } catch (error: unknown) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        const existingUser = await this.findUserByIdentity(identity);

        if (existingUser !== null) {
          return this.updateExistingUser(existingUser, identity);
        }
      }
    }

    throw new Error(`Unable to allocate a unique username for Auth0 subject ${identity.authSubject}`);
  }

  private resolveEmail(identity: AuthenticatedIdentity): string {
    if (identity.email !== null) {
      return identity.email;
    }

    return `auth0+${this.sanitizeUsernameSegment(identity.authSubject)}@${EMAIL_PLACEHOLDER_DOMAIN}`;
  }

  private resolveUsernameBase(identity: AuthenticatedIdentity): string {
    const usernameCandidates = [
      identity.nickname,
      identity.name,
      this.extractEmailLocalPart(identity.email),
      this.extractSubjectTail(identity.authSubject),
    ];

    for (const candidate of usernameCandidates) {
      const sanitized = this.sanitizeUsernameSegment(candidate);
      if (sanitized.length > 0) {
        return sanitized;
      }
    }

    return USERNAME_FALLBACK;
  }

  private extractEmailLocalPart(email: string | null): string | null {
    if (email === null) {
      return null;
    }

    const [localPart] = email.split('@');
    return localPart ?? null;
  }

  private extractSubjectTail(subject: string): string {
    const subjectParts = subject.split(/[|:/]/u);
    return subjectParts.at(-1) ?? subject;
  }

  private sanitizeUsernameSegment(value: string | null): string {
    if (value === null) {
      return '';
    }

    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }

  private toCurrentUserProfileView(user: StoredUserRecord): CurrentUserProfileView {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      country: user.country,
      favoriteTeamId: user.favoriteTeamId,
      avatar: user.avatar,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeCurrentUserProfileInput(
    input: UpdateCurrentUserProfileInput,
  ): NormalizedCurrentUserProfileInput {
    const country = this.normalizeRequiredString(input.country, 'Country').toUpperCase();

    if (!COUNTRY_CODE_REGEX.test(country)) {
      throw new BadRequestException('Country must be an uppercase ISO alpha-2 code');
    }

    const preferredLanguage = this.normalizeRequiredString(input.preferredLanguage, 'Preferred language').toLowerCase();

    if (!this.isPreferredLanguage(preferredLanguage)) {
      throw new BadRequestException(
        `Preferred language must be one of: ${PREFERRED_LANGUAGE_VALUES.SPANISH}, ${PREFERRED_LANGUAGE_VALUES.ENGLISH}`,
      );
    }

    const favoriteTeamId = this.normalizeRequiredString(input.favoriteTeamId, 'Favorite team');

    return {
      country,
      favoriteTeamId,
      preferredLanguage,
    };
  }

  private isPreferredLanguage(value: string): value is PreferredLanguage {
    return value === PREFERRED_LANGUAGE_VALUES.SPANISH || value === PREFERRED_LANGUAGE_VALUES.ENGLISH;
  }

  private normalizeRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalizedValue;
  }
}
