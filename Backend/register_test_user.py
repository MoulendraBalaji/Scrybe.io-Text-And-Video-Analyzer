import requests

data = {
    "username": "admin",
    "password": "password123",
    "first_name": "Admin",
    "last_name": "User"
}

try:
    response = requests.post("http://127.0.0.1:8000/register", json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
