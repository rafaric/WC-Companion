import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
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
  name: string;
}

export interface JoinGroupInput {
  identity: AuthenticatedIdentity;
  inviteCode: string;
}

export interface GroupView {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: Date;
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
    const activeTournament = await this.tournamentsService.getActiveTournament();

    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
      const inviteCode = this.generateInviteCode();

      try {
        const createdGroup = await this.prisma.$transaction(async (transaction) => {
          const group = await transaction.group.create({
            data: {
              tournamentId: activeTournament.id,
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

        return this.toGroupView(createdGroup);
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
      return this.toGroupView(group);
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

    return this.toGroupView(group);
  }

  async getMyGroups(input: { identity: AuthenticatedIdentity }): Promise<MyGroupView[]> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);

    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        userId: user.id,
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

    return memberships.map((membership) => this.toMyGroupView(membership as GroupMembershipRecord));
  }

  private normalizeGroupName(name: string): string {
    const normalizedName = name.trim();

    if (normalizedName.length === 0) {
      throw new BadRequestException('Group name is required');
    }

    if (normalizedName.length > GROUP_NAME_MAX_LENGTH) {
      throw new BadRequestException(`Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`);
    }

    return normalizedName;
  }

  private normalizeInviteCode(inviteCode: string): string {
    const normalizedInviteCode = inviteCode.trim().toUpperCase();

    if (normalizedInviteCode.length === 0) {
      throw new BadRequestException('Invite code is required');
    }

    return normalizedInviteCode;
  }

  private generateInviteCode(): string {
    const randomValue = BigInt(`0x${randomBytes(INVITE_CODE_BYTES).toString('hex')}`);

    return randomValue.toString(36).toUpperCase().padStart(13, '0');
  }

  private toGroupView(group: GroupRecord): GroupView {
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      tournamentId: group.tournamentId,
      createdAt: group.createdAt,
    };
  }

  private toMyGroupView(membership: GroupMembershipRecord): MyGroupView {
    return {
      role: membership.role,
      ...this.toGroupView(membership.group),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
