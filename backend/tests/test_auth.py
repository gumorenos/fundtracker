def test_login_admin(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "adminpass"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/auth/login", json={"username": "nobody", "password": "x"})
    assert r.status_code == 401


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
