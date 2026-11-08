import { html } from "hono/html";
import { MAX_PICK_COUNT } from "../sessions";
import { LANDING_TITLE, SOCIAL_HEAD, page } from "./shell";

export const PICK_PRESETS = ["5", "10"] as const;

// Pills are radio inputs, so the form works without JS.
export const createForm = (error?: string) =>
  page(
    LANDING_TITLE,
    html`<header class="hero on-indigo">
        <div class="wrap">
          <div class="container">
            <div class="hero-grid">
              <div class="hero-copy">
                <div class="mono accent">Reverse bingo for meetings</div>
                <h1>Predict the jargon. Win the meeting.</h1>
                <p>Guess the buzzwords before the call. Get scored against the transcript after.</p>
                <div class="hero-actions">
                  <a class="btn btn-bone" href="#how">See how it works</a>
                </div>
              </div>
              <div class="card" id="new">
                <form method="post" action="/sessions" class="card-body">
                  <h2>New session</h2>
                  ${error ? html`<p class="error" role="alert">${error}</p>` : ""}
                  <fieldset class="pills">
                    <legend>Maximum picks</legend>
                    <div class="row">
                      <label><input type="radio" name="pick_preset" id="pick-custom" value="custom" checked /><span>Custom</span></label>
                      ${PICK_PRESETS.map(
                        (n) => html`<label><input type="radio" name="pick_preset" value="${n}" /><span>${n}</span></label>`,
                      )}
                    </div>
                  </fieldset>
                  <label class="field" id="custom-pick">
                    <input type="number" name="pick_count" min="1" max="${MAX_PICK_COUNT}" step="1" value="7" inputmode="numeric" aria-label="Maximum picks" />
                    <span class="hint">Choose between 1 and ${MAX_PICK_COUNT}.</span>
                  </label>
                  <div>
                    <div class="zig" aria-hidden="true"></div>
                    <button type="submit" class="btn btn-red">Create Session</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>
        <section class="wrap" id="how">
          <div class="container section">
            <div>
              <div class="mono">How it works</div>
              <h2>Three steps. One of them is a meeting.</h2>
            </div>
            <div class="steps">
              <div class="step"><span class="n">1</span><div><h3>Create a session</h3><p>Set the most words each player can pick. Share the invite link.</p></div></div>
              <div class="step"><span class="n">2</span><div><h3>Everyone predicts</h3><p>Each player locks in their jargon picks before the call.</p></div></div>
              <div class="step"><span class="n">3</span><div><h3>Meeting, then scores</h3><p>Upload the transcript after. The leaderboard writes itself.</p></div></div>
            </div>
          </div>
        </section>
        <section class="wrap">
          <div class="container who">
            <div class="mono" id="privacy">Privacy</div>
            <div class="card"><p>Transcripts are never saved. That is our mojo!</p></div>
            <div class="card"><p>Picks and results are only saved as long as your session is live and open.</p></div>
            <div class="card"><p>Game telemetry is collected for logs without personal data.</p></div>
          </div>
        </section>
        <section class="band wrap">
          <div class="container">
            <h2>C’mon, get your mumbah-jumbah together!</h2>
            <div class="actions"><a class="btn btn-red" href="#new">Create a session</a></div>
          </div>
        </section>
      </main>
      <script>
        // The number input is always visible: picking 5 or 10 fills it in, typing in it switches back to Custom.
        // Without JS the checked preset wins on the server, so the form still works.
        (function () {
          var form = document.querySelector('form[action="/sessions"]');
          var input = form.querySelector('input[name="pick_count"]');
          var custom = form.querySelector("#pick-custom");
          form.addEventListener("change", function (e) {
            var t = e.target;
            if (t && t.name === "pick_preset" && t.value !== "custom") input.value = t.value;
          });
          input.addEventListener("input", function () {
            custom.checked = true;
          });
        })();
      </script>`,
    true,
    SOCIAL_HEAD,
  );
