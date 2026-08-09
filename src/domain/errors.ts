import { Data } from "effect";

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly _reason?: string;
}> {}
export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly _reason?: string;
}> {}
export class InvalidCredentials extends Data.TaggedError("InvalidCredentials")<{
  readonly _reason?: string;
}> {}
export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}
export class NotFound extends Data.TaggedError("NotFound")<{ entity: string }> {}
export class GameLocked extends Data.TaggedError("GameLocked")<{
  gameId: string;
}> {}
export class NflApiError extends Data.TaggedError("NflApiError")<{
  message: string;
}> {}
export class SetupTokenInvalid extends Data.TaggedError("SetupTokenInvalid")<{
  readonly _reason?: string;
}> {}
