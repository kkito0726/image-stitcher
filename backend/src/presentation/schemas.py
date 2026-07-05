from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str


class StitchFailureResponse(BaseModel):
    isStitched: int
    reason: str
