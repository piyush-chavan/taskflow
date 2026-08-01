## API Endpoints

### health
- /health GET
    {
    "status": "ok"
    }

### auth
- /auth/register POST
    request_body = {
        "name":"Piyush",
        "email":"piyush@test.com",
        "password":"abcd1234"
    }

    // 201 Created
    response = {
    "name": "Piyush",
    "email": "piyush@test.com",
    "id": 6
    }

- /auth/login POST
    request_body = {
        "email":"piyush@test.com",
        "password":"abcd1234"
    }

    // 200 OK
    response = {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiZXhwIjoxNzg1NjIxMzg2fQ.0x0Ax2Fjz3_sYizGu_EEexwlF6jglESL_5_iRym5AwQ",
    "token_type": "bearer"
    }

    // 401 Unauthorised
    response = {
    "detail": "Incorrect email or password"
    }

- auth/me GET

    // 200 OK
    response={
    "name": "Piyush",
    "email": "piyush@test.com",
    "id": 6
    }

    // 401 Unauthorised
    response={
    "detail": "Could not validate credentials"
    }

### projects

- projects/ POST

    request_body = {
        "name":"piyush demo project",
        "descreption":"this is just a demo project. for purpose of testing"
    }

    // 201 Created
    response={
    "name": "piyush demo project",
    "description": null,
    "id": 5,
    "owner_id": 6
    }

- projects/ GET

    // 200 OK
    response=[
        {
            "name": "piyush demo project",
            "description": null,
            "id": 5,
            "owner_id": 6
        }
    ]

- projects/{project_id} GET
    // projects/5
    response={
    "name": "piyush demo project",
    "description": null,
    "id": 5,
    "owner_id": 6
    }

    // projects/6
    // 404 Not Found
    response={
    "detail": "Project not found"
    }

- projects/{project_id} PUT
- project/{project_id} DELETE

### tasks
- tasks/ POST
    request_body={
    "title":"Complete Fundamental Backend for Taskflow Project",
    "description":"N/A",
    "status":"in_progress",
    "priority":"high",
    "due_date":"today",
    "project_id":5
    }

    // 201 Created
    response={
    "id": 4,
    "title": "Complete Fundamental Backend for Taskflow Project",
    "description": "N/A",
    "status": "in_progress",
    "priority": "high",
    "due_date": "today",
    "project_id": 5
    }

    //  422 Unprocessable Content
    response = {
        "detail": [
            {
                "type": "literal_error",
                "loc": [
                    "body",
                    "status"
                ],
                "msg": "Input should be 'pending', 'in_progress' or 'completed'",
                "input": "in-progress",
                "ctx": {
                    "expected": "'pending', 'in_progress' or 'completed'"
                }
            },
            {
                "type": "literal_error",
                "loc": [
                    "body",
                    "priority"
                ],
                "msg": "Input should be 'low', 'medium' or 'high'",
                "input": "max",
                "ctx": {
                    "expected": "'low', 'medium' or 'high'"
                }
            },
            {
                "type": "missing",
                "loc": [
                    "body",
                    "project_id"
                ],
                "msg": "Field required",
                "input": {
                    "title": "Complete Fundamental Backend for Taskflow Project",
                    "description": "N/A",
                    "status": "in-progress",
                    "priority": "max",
                    "due_date": "today"
                }
            }
        ]
    }

- tasks/ GET
    response=[
        {
            "id": 4,
            "title": "Complete Fundamental Backend for Taskflow Project",
            "description": "N/A",
            "status": "in_progress",
            "priority": "high",
            "due_date": "today",
            "project_id": 5
        }
    ]
- tasks/{task_id} GET
- tasks/{task_id} PUT
- tasks/{task_id} DELETE

