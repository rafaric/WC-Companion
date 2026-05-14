import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService, type TournamentContextInput } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';

const GROUP_NAME_MAX_LENGTH = 80;
const INVITE_CODE_MAX_ATTEMPTS = 10;
const INVITE_CODE_BYTES = 8;

const GROUP_VIEW_SELECT = {
  id: true,
  name: true,
  inviteCode: true,
  tournamentId: true,
  createdAt: true,
} as const;

export interface CreateGroupInput {
  identity: AuthenticatedIdentity;
  name: unknown;
  tournamentContext?: TournamentContextInput;
}

export interface JoinGroupInput {
  identity: AuthenticatedIdentity;
  inviteCode: unknown;
}

export interface GroupView {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: Date;
  memberCount: number;
}

export interface MyGroupView extends GroupView {
  role: GroupRole;
}

interface GroupRecord {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: Date;
}

interface GroupMembershipRecord {
  role: GroupRole;
  group: GroupRecord;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async createGroup(input: CreateGroupInput): Promise<GroupView> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);
    const name = this.normalizeGroupName(input.name);

    // Resolve tournament context: explicit -> cookie -> ACTIVE fallback
    const resolved = await this.tournamentsService.resolveTournamentContext(input.tournamentContext ?? {});

    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
      const inviteCode = this.generateInviteCode();

      try {
        const createdGroup = await this.prisma.$transaction(async (transaction) => {
          const group = await transaction.group.create({
            data: {
              tournamentId: resolved.tournament.id,
              ownerId: user.id,
              name,
              inviteCode,
            },
            select: GROUP_VIEW_SELECT,
          });

          await transaction.groupMembership.create({
            data: {
              groupId: group.id,
              userId: user.id,
              role: GroupRole.OWNER,
            },
          });

          return group;
        });

        const memberCount = await this.prisma.groupMembership.count({
          where: {
            groupId: createdGroup.id,
          },
        });

        return this.toGroupView(createdGroup, memberCount);
      } catch (error: unknown) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new Error('Unable to allocate a unique invite code for the group');
  }

  async joinGroup(input: JoinGroupInput): Promise<GroupView> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);
    const inviteCode = this.normalizeInviteCode(input.inviteCode);

    const group = await this.prisma.group.findUnique({
      where: {
        inviteCode,
      },
      select: GROUP_VIEW_SELECT,
    });

    if (group === null) {
      throw new NotFoundException(`Group with invite code ${inviteCode} was not found`);
    }

    const existingMembership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: group.id,
        userId: user.id,
      },
      select: {
        role: true,
      },
    });

    if (existingMembership !== null) {
      return this.toGroupView(group, await this.countGroupMembers(group.id));
    }

    try {
      await this.prisma.groupMembership.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: GroupRole.MEMBER,
        },
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }
    }

    return this.toGroupView(group, await this.countGroupMembers(group.id));
  }

  async getMyGroups(input: { identity: AuthenticatedIdentity; tournamentContext?: TournamentContextInput }): Promise<MyGroupView[]> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);

    // Resolve tournament context to filter groups by tournament when provided
    const resolved = await this.tournamentsService.resolveTournamentContext(input.tournamentContext ?? {});

    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        userId: user.id,
        group: {
          tournamentId: resolved.tournament.id,
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
      select: {
        role: true,
        group: {
          select: GROUP_VIEW_SELECT,
        },
      },
    });

    return Promise.all(memberships.map((membership) => this.toMyGroupView(membership as GroupMembershipRecord)));
  }

  private normalizeGroupName(name: unknown): string {
    const normalizedName = this.normalizeRequiredString(name, 'Group name');

    if (normalizedName.length === 0) {
      throw new BadRequestException('Group name is required');
    }

    if (normalizedName.length > GROUP_NAME_MAX_LENGTH) {
      throw new BadRequestException(`Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`);
    }

    return normalizedName;
  }

  private normalizeInviteCode(inviteCode: unknown): string {
    const normalizedInviteCode = this.normalizeRequiredString(inviteCode, 'Invite code').toUpperCase();

    return normalizedInviteCode;
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

  private generateInviteCode(): string {
    const randomValue = BigInt(`0x${randomBytes(INVITE_CODE_BYTES).toString('hex')}`);

    return randomValue.toString(36).toUpperCase().padStart(13, '0');
  }

  private async countGroupMembers(groupId: string): Promise<number> {
    return this.prisma.groupMembership.count({
      where: {
        groupId,
      },
    });
  }

  private toGroupView(group: GroupRecord, memberCount: number): GroupView {
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      tournamentId: group.tournamentId,
      createdAt: group.createdAt,
      memberCount,
    };
  }

  private async toMyGroupView(membership: GroupMembershipRecord): Promise<MyGroupView> {
    const memberCount = await this.countGroupMembers(membership.group.id);

    return {
      role: membership.role,
      ...this.toGroupView(membership.group, memberCount),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
