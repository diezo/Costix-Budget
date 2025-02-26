from flask import Response
import json


def JSONResponse(response: dict, status: int) -> Response:
    """
    Parses and returns a JSON response for Flask.
    """

    return Response(
        response=json.dumps(response),
        status=status,
        content_type="application/json"
    )
