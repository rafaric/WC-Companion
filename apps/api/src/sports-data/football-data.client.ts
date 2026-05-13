import type {
  FootballDataClientLike,
  FootballDataClientOptions,
  FootballDataMatchCollectionResponse,
  FootballDataTeamCollectionResponse,
  FootballDataTournamentConfig,
} from './football-data.types';

const DEFAULT_BASE_URL = 'https://api.football-data.org/v4';

export class FootballDataClient implements FootballDataClientLike {
  private readonly baseUrl: string;

  constructor(private readonly options: FootballDataClientOptions = {}) {
    this.baseUrl = options.baseUrl?.trim() || DEFAULT_BASE_URL;
  }

  async listTeams(tournamentConfig: FootballDataTournamentConfig): Promise<FootballDataTeamCollectionResponse> {
    return this.request<FootballDataTeamCollectionResponse>(this.buildCompetitionPath(tournamentConfig, 'teams'));
  }

  async listMatches(tournamentConfig: FootballDataTournamentConfig): Promise<FootballDataMatchCollectionResponse> {
    return this.request<FootballDataMatchCollectionResponse>(this.buildCompetitionPath(tournamentConfig, 'matches'));
  }

  private buildCompetitionPath(tournamentConfig: FootballDataTournamentConfig, resource: 'teams' | 'matches'): string {
    const path = `/competitions/${encodeURIComponent(String(tournamentConfig.competitionId))}/${resource}`;
    const searchParams = new URLSearchParams();

    if (tournamentConfig.season !== null) {
      searchParams.set('season', String(tournamentConfig.season));
    }

    const query = searchParams.toString();
    return query.length > 0 ? `${path}?${query}` : path;
  }

  private async request<TResponse>(path: string): Promise<TResponse> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.createHeaders(),
    });

    if (!response.ok) {
      throw new Error(`football-data.org request failed with status ${response.status}`);
    }

    return (await response.json()) as TResponse;
  }

  private createHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.options.apiToken?.trim()) {
      headers['X-Auth-Token'] = this.options.apiToken.trim();
    }

    return headers;
  }
}
