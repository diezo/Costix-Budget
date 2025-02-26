# Costix - Expense Splitting & Tracking Website
Costix is an open-source expense management website for friends. It supports managing friends, logging expenses & settlements, and viewing past transactions.

<img src="https://i.ibb.co/bMx1m5nS/costix-banner.png" style="width: 100%" />

## ⚙️ Configuration
Before you proceed, please follow these steps:
1. Update your environment variables inside ```.env``` file.
2. For production, open [```api/v1.py```](https://github.com/diezo/costix-budget/blob/main/api/v1.py) and edit the ```BASE_URL``` to reflect your own domain.

## Install Dependencies
Run this command:

```sh
pip3 install -r requirements.txt
```

Alternatively, if you have **Make** installed:

```sh
make install
```

### Run the server
Run this command in terminal:

```sh
$ python3 main.py
```
