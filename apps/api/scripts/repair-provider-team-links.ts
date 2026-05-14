import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { slug: 'world-cup-2026' },
    select: { id: true, name: true },
  });

  if (!tournament) {
    throw new Error('Tournament world-cup-2026 not found');
  }

  const references = await prisma.externalTeamReference.findMany({
    where: {
      providerKey: 'football-data',
      tournamentId: tournament.id,
    },
    select: {
      externalId: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
          shortName: true,
          countryCode: true,
          flagCode: true,
          primaryColor: true,
          secondaryColor: true,
          tournamentId: true,
        },
      },
    },
  });

  const targetTeamsByExternalId = new Map<string, string>();

  for (const reference of references) {
    if (reference.team.tournamentId === tournament.id) {
      targetTeamsByExternalId.set(reference.externalId, reference.teamId);
      continue;
    }

    const repairedTeam = await prisma.team.upsert({
      where: {
        tournamentId_name: {
          tournamentId: tournament.id,
          name: reference.team.name,
        },
      },
      create: {
        tournamentId: tournament.id,
        name: reference.team.name,
        shortName: reference.team.shortName,
        countryCode: reference.team.countryCode,
        flagCode: reference.team.flagCode,
        primaryColor: reference.team.primaryColor,
        secondaryColor: reference.team.secondaryColor,
      },
      update: {},
      select: {
        id: true,
      },
    });

    await prisma.externalTeamReference.updateMany({
      where: {
        providerKey: 'football-data',
        tournamentId: tournament.id,
        externalId: reference.externalId,
      },
      data: {
        teamId: repairedTeam.id,
      },
    });

    targetTeamsByExternalId.set(reference.externalId, repairedTeam.id);
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      homeTeam: {
        select: {
          id: true,
          name: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const providerTeams = await prisma.team.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      name: true,
    },
  });

  const providerTeamIdByName = new Map(providerTeams.map((team) => [team.name, team.id]));

  let repaired = 0;

  for (const match of matches) {
    const correctHomeTeamId = providerTeamIdByName.get(match.homeTeam.name);
    const correctAwayTeamId = providerTeamIdByName.get(match.awayTeam.name);

    if (!correctHomeTeamId || !correctAwayTeamId) {
      continue;
    }

    if (match.homeTeam.id === correctHomeTeamId && match.awayTeam.id === correctAwayTeamId) {
      continue;
    }

    await prisma.match.update({
      where: { id: match.id },
      data: {
        homeTeamId: correctHomeTeamId,
        awayTeamId: correctAwayTeamId,
      },
    });

    repaired += 1;
  }

  const usersWithFavoriteTeam = await prisma.user.findMany({
    where: {
      favoriteTeamId: {
        not: null,
      },
    },
    select: {
      id: true,
      favoriteTeam: {
        select: {
          id: true,
          name: true,
          tournamentId: true,
        },
      },
    },
  });

  let repairedFavoriteTeams = 0;

  for (const user of usersWithFavoriteTeam) {
    if (!user.favoriteTeam || user.favoriteTeam.tournamentId === tournament.id) {
      continue;
    }

    const replacementFavoriteTeamId = providerTeamIdByName.get(user.favoriteTeam.name);

    if (!replacementFavoriteTeamId) {
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        favoriteTeamId: replacementFavoriteTeamId,
      },
    });

    repairedFavoriteTeams += 1;
  }

  const mismatches = await prisma.match.count({
    where: {
      tournamentId: tournament.id,
      OR: [
        {
          homeTeam: {
            tournamentId: {
              not: tournament.id,
            },
          },
        },
        {
          awayTeam: {
            tournamentId: {
              not: tournament.id,
            },
          },
        },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        tournament: tournament.name,
        repaired,
        repairedFavoriteTeams,
        mismatchesRemaining: mismatches,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
