---
title: REST API Reference
description: Complete specification of the 25 HTTP endpoints of the Synergia REST API, methods, authentication requirements, and flows.
---

The Synergia REST API orchestrates all business operations within the ecosystem. It is implemented in **FastAPI** under the **Uvicorn** ASGI server and exposes its services by default on port **`8000`**.

<div class="openapi-download-card">
  <div class="openapi-download-card__content">
    <strong>Swagger UI Documentation</strong>
    <p>Explore all endpoints of the Synergia protocol interactively and in detail in Swagger UI.</p>
  </div>
  <a href="../../swagger.html" class="openapi-download-btn">OPEN SWAGGER PLAYGROUND</a>
</div>

---

## General Communication Directives

* **Data format:** All requests and responses use standard `application/json` encoding, except for the result upload endpoint which uses `multipart/form-data`.
* **Authentication Mechanism:** A custom header named `token` is used, containing the session JSON Web Token (JWT) signed by the server:
  `token: <JWT_VALUE>`
  *The standard `Authorization: Bearer <JWT>` header is not used.*

---

## Account and Authentication Endpoints

| Method | HTTP Route | Requires Auth | Description / Behavior |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/account` | No | Creates a new account. Hashes the password with **Argon2id**, credits the balance with welcoming `INITIAL_CREDITS`, generates a temporary JWT token, and sends a signed confirmation email via SMTP. |
| **`GET`** | `/account/{username}` | No | Retrieves the public profile of the user: weighted reputation, current credit balance, and cryptographic transfer history. |
| **`GET`** | `/verify-email` | Verification Token | Validates the JWT sent in the URL (`?token=`) with the purpose `email_verification` and marks the local account as verified. |
| **`POST`** | `/token` | No | Local login by credentials. Receives `username` or `email` plus the password in the JSON body, validates against Argon2, and returns the 24-hour session JWT. |
| **`GET`** | `/auth/google` | No | Generates and returns the official Google OAuth2 flow URL, injecting a random security parameter `state` anti-CSRF saved in a 5-minute TTL temporary cache. |
| **`GET`** | `/auth/google/callback` | No | Callback intercepted by the server. Exchanges the code `code` for the Google token, retrieves the user's email, automatically creates the account if it is a new email, and issues a Synergia JWT. |
| **`GET`** | `/auth/github` | No | Equivalent to `/auth/google` to perform OAuth 2.0 login against GitHub. |
| **`GET`** | `/auth/github/callback` | No | GitHub callback. Resolves the access token; if the email of the GitHub account is private, it makes a secondary encrypted call to the `/user/emails` security endpoint of the GitHub API to validate it. |

---

## Task Management Endpoints (Publisher / General)

| Method | HTTP Route | Requires Auth | Description / Behavior |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/task` | **JWT** | Publishes a new task. Deducts the fixed publication cost `TASK_COST` from the publisher's account, parses the repository's `config.toml` to create chunks in RabbitMQ, and initializes relational parameters. |
| **`GET`** | `/task` | Optional | Lists all tasks on the network. If the JWT session token is provided, it supports the `?subscribed=true` filter to return only the tasks to which your worker has subscribed. |
| **`GET`** | `/task/{id}` | No | Shows public details, metadata, and the expected snapshot hash for a specific task on the network. |
| **`PATCH`** | `/task/{id}` | **JWT (Publisher)** | Synchronizes and updates the integrity snapshot hash signature (`repo_snapshot_hash`) and the repository commit reference on the server after making a legitimate code change. |
| **`PATCH`** | `/task/{id}/status` | **JWT (Publisher)** | Alters the operational cycle state of the task (`ACTIVE`, `PAUSED`, `CANCELLED`). The transition to `ACTIVE` validates that the publisher has sufficient credits. Cancellation immediately deletes the RabbitMQ queue. |
| **`POST`** | `/task/{id}/input` | **JWT (Publisher)** | Injects new items on the fly to an active dynamic task of type `dynamic`. The payload is directly injected as RabbitMQ messages. |
| **`DELETE`** | `/task/{id}/subscription` | **JWT** | Permanently detaches the subscription of a worker user from the task. |
| **`GET`** | `/task/{id}/progress` | No | Returns the number of total items successfully processed and verified versus those pending in the queue. |
| **`GET`** | `/task/{id}/output` | No | Retrieves processing results. If `?download=true` is passed, it dynamically packages output files into a streaming ZIP. The `?canonical_only=true` parameter discards files that did not win consensus. |

---

## Processing and Executions Endpoints (Worker)

| Method | HTTP Route | Requires Auth | Description / Behavior |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/task/{id}/process` | **JWT** | The worker declares the start of processing of a range of items (chunk). It creates a record in the `process` and `execution` tables with a `PENDING` state. It validates that the range does not overlap with active processes and that the worker's local snapshot matches that of the task. |
| **`GET`** | `/task/{id}/process` | No | Lists the processes created for a task, or locates the specific process that spans a particular input index (`?index=`). |
| **`GET`** | `/task/{id}/process/{pid}` | No | Retrieves extended metadata of a process, its boundary range, and the ID of its official canonical execution. |
| **`GET`** | `/task/{id}/process/{pid}/executions` | No | Lists all individual execution attempts made by different workers on the specified process. |
| **`POST`** | `/task/{id}/process/{pid}/execution` | **JWT** | Registers a validator worker's attempt to perform cross-verification on a process previously processed by another node. |
| **`POST`** | `/task/{id}/process/{pid}/execution/{eid}/result` | **JWT** | **Result upload (`multipart/form-data`):** Uploads the compressed binary output package and attaches collected physical metrics (CPU cycles, average RAM, average VRAM, and TDP). Triggers Welford's algorithm, calculates the returned credits, and updates the majority consensus. |
| **`GET`** | `/task/{id}/confirm` | **JWT** | The worker asks which process of the task most urgently requires verification by its node. The server responds with the ID based on operational suspicion profiles. |

---

## Observability Endpoints

| Method | HTTP Route | Requires Auth | Description / Behavior |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/metrics` | No | Exposes the operational metrics of the REST server in a Prometheus-compatible format (active worker ports, physical upload volume, credits paid, etc.). |



<script is:inline>
  // Mock data/examples for endpoints
  const ENDPOINTS_DATA = {
    create_account: {
      inputs: [
        { name: 'username', label: 'Username', type: 'text', value: 'cyberworker' },
        { name: 'email', label: 'Email address', type: 'email', value: 'worker@synergia.dev' },
        { name: 'password', label: 'Password', type: 'password', value: 'password123' }
      ],
      mockResponse: {
        status: 201,
        statusText: 'Created',
        body: {
          status: "created",
          username: "cyberworker",
          initial_credits: 100.0,
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjeWJlcndvcmtlciJ9..."
        }
      }
    },
    login: {
      inputs: [
        { name: 'username', label: 'Username or Email', type: 'text', value: 'cyberworker' },
        { name: 'password', label: 'Password', type: 'password', value: 'password123' }
      ],
      mockResponse: {
        status: 200,
        statusText: 'OK',
        body: {
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjeWJlcndvcmtlciIsImV4cCI6MTcxOTk0MDUxNn0...",
          expires_in: 86400
        }
      }
    },
    list_tasks: {
      inputs: [
        { name: 'subscribed', label: 'Subscribed (?subscribed=)', type: 'text', value: 'false' }
      ],
      mockResponse: {
        status: 200,
        statusText: 'OK',
        body: [
          {
            id: "task-889a-4c22-b2df",
            title: "Monte Carlo Fluid Simulation",
            repo_url: "https://github.com/synergia/montecarlo-fluids",
            status: "ACTIVE",
            total_chunks: 500,
            completed_chunks: 124,
            reward_per_chunk: 12.50
          },
          {
            id: "task-c1b2-4411-9a99",
            title: "Mini-LLM Pretraining",
            repo_url: "https://github.com/synergia/mini-llm",
            status: "ACTIVE",
            total_chunks: 1000,
            completed_chunks: 92,
            reward_per_chunk: 45.00
          }
        ]
      }
    },
    create_task: {
      inputs: [
        { name: 'token', label: 'JWT Token (Header)', type: 'text', value: 'eyJhbGciOiJIUzI1Ni...' },
        { name: 'title', label: 'Task Title', type: 'text', value: 'Genomic Analysis Phase 2' },
        { name: 'repo_url', label: 'Repository URL', type: 'text', value: 'https://github.com/synergia/genomics-2' }
      ],
      mockResponse: {
        status: 201,
        statusText: 'Created',
        body: {
          id: "task-f3c2-4011-8be2",
          status: "ACTIVE",
          cost: 15.00,
          created_at: "2026-08-28T16:45:00Z"
        }
      }
    },
    declare_process: {
      inputs: [
        { name: 'token', label: 'JWT Token (Header)', type: 'text', value: 'eyJhbGciOiJIUzI1Ni...' },
        { name: 'task_id', label: 'Task ID', type: 'text', value: 'task-889a-4c22-b2df' },
        { name: 'start_index', label: 'Start Index', type: 'number', value: '10' },
        { name: 'end_index', label: 'End Index', type: 'number', value: '20' }
      ],
      mockResponse: {
        status: 200,
        statusText: 'OK',
        body: {
          process_id: "proc-99e2-fa12",
          status: "PENDING",
          deadline: "2026-08-28T18:00:00Z",
          allocated_worker: "cyberworker"
        }
      }
    },
    metrics: {
      inputs: [],
      mockResponse: {
        status: 200,
        statusText: 'OK',
        body: "# HELP synergia_active_workers Number of currently active nodes\n# TYPE synergia_active_workers gauge\nsynergia_active_workers 142\n\n# HELP synergia_tasks_total Total tasks published on the network\n# TYPE synergia_tasks_total counter\nsynergia_tasks_total 12\n\n# HELP synergia_credits_distributed_total Total credits distributed to workers\n# TYPE synergia_credits_distributed_total counter\nsynergia_credits_distributed_total 8540.22"
      }
    }
  };

  function initPlayground() {
    const select = document.getElementById('endpoint-select');
    const paramsDiv = document.getElementById('playground-params');
    const btnSend = document.getElementById('btn-send-request');
    const statusSpan = document.getElementById('response-status');
    const bodyCode = document.getElementById('response-body');

    if (!select || !paramsDiv || !btnSend) return;

    function renderParams() {
      const endpointKey = select.value;
      const data = ENDPOINTS_DATA[endpointKey];
      paramsDiv.innerHTML = '';

      if (data && data.inputs && data.inputs.length > 0) {
        data.inputs.forEach(input => {
          const group = document.createElement('div');
          group.className = 'param-group';

          const label = document.createElement('label');
          label.textContent = input.label;

          const inputEl = document.createElement('input');
          inputEl.type = input.type;
          inputEl.value = input.value;
          inputEl.className = 'param-input';
          inputEl.dataset.name = input.name;

          group.appendChild(label);
          group.appendChild(inputEl);
          paramsDiv.appendChild(group);
        });
      } else {
        const noParams = document.createElement('p');
        noParams.textContent = 'This endpoint does not require parameters in the sandbox.';
        noParams.style.fontSize = '0.8rem';
        noParams.style.color = 'var(--sl-color-text-muted)';
        paramsDiv.appendChild(noParams);
      }
    }

    select.addEventListener('change', renderParams);
    renderParams();

    btnSend.onclick = () => {
      btnSend.disabled = true;
      btnSend.textContent = 'PROCESSING...';
      
      setTimeout(() => {
        const endpointKey = select.value;
        const mock = ENDPOINTS_DATA[endpointKey].mockResponse;

        statusSpan.textContent = `${mock.status} ${mock.statusText}`;
        if (mock.status >= 200 && mock.status < 300) {
          statusSpan.className = 'status-indicator';
        } else {
          statusSpan.className = 'status-indicator error';
        }

        if (typeof mock.body === 'string') {
          bodyCode.textContent = mock.body;
        } else {
          bodyCode.textContent = JSON.stringify(mock.body, null, 2);
        }

        btnSend.disabled = false;
        btnSend.textContent = 'Send Request';
      }, 400);
    };
  }

  // Execute both on load and on Astro/Starlight page change
  document.addEventListener('DOMContentLoaded', initPlayground);
  window.addEventListener('astro:page-load', initPlayground);
  
  // In case the script loads after DOMContentLoaded
  if (document.readyState !== 'loading') {
    initPlayground();
  }
</script>