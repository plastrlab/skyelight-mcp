/**
 * How Skyelight shows up inside an agent: its icon, and the words ChatGPT
 * shows while a tool runs.
 *
 * The icon is embedded rather than linked. A link would name one host, and
 * the same package serves QA, production and local deployments; a data URI
 * is the same everywhere and needs no request. The mark from
 * `public/favicon.png` (258 by 258), about 4 KB.
 *
 * Nothing here can animate while a tool runs. Clients draw their own
 * loading state and give a server no way into it; the icon sits beside the
 * connector and its tool calls, and ChatGPT's status line is the only text
 * a server gets to put in that moment.
 */

/** The mark itself, for a server that serves it at a URL instead. */
export const ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAQIAAAECCAYAAAAVT9lQAAAACXBIWXMAAAsTAAALEwEAmpwYAAABaWlDQ1BEaXNwbGF5IFAzAAB4nHWQvUvDUBTFT6tS0DqIDh0cMolD1NIKdnFoKxRFMFQFq1OafgltfCQpUnETVyn4H1jBWXCwiFRwcXAQRAcR3Zw6KbhoeN6XVNoi3sfl/Ticc7lcwBtQGSv2AijplpFMxKS11Lrke4OHnlOqZrKooiwK/v276/PR9d5PiFlNu3YQ2U9cl84ul3aeAlN//V3Vn8maGv3f1EGNGRbgkYmVbYsJ3iUeMWgp4qrgvMvHgtMunzuelWSc+JZY0gpqhrhJLKc79HwHl4plrbWD2N6f1VeXxRzqUcxhEyYYilBRgQQF4X/8044/ji1yV2BQLo8CLMpESRETssTz0KFhEjJxCEHqkLhz634PrfvJbW3vFZhtcM4v2tpCAzidoZPV29p4BBgaAG7qTDVUR+qh9uZywPsJMJgChu8os2HmwiF3e38M6Hvh/GMM8B0CdpXzryPO7RqFn4Er/QcXKWq8MSlPPgAAAA50RVh0U29mdHdhcmUARmlnbWGesZZjAAAOuElEQVR4Ae3dzY4c1RXA8dOGKFEkpNkniPETYF4gbj9AFHgCzDIr8DJSiMchrBmeAPsJIIusPayyC8MDJO4oO6JEA0QRC9vNvTN1YGbcH/Vx7q1z7/3/pFIPQjDlcde/zq3uqRYBAAAAAAAAAAAAAAAAAAAAAAAAAAAAgCsWgqYcPVkf/FTk4KnI4aZ//7LI6nc3FytBUwhBxT58sr71TGQZvnx9LXJLLg7+g57/+Wl4cqzC4+fh8fT9m4sTQbUIQUXi2f6lcMCHg/7tsL0p/Q/6XsKT5SQ8PHoeHo+YGqpCCCrQnfnjwX9XjA/+bcIT52HYHjEp1IEQFOyDJ+tlOPjvry/G/7mswpPowR9uLh4KikUIChSWAIc3RD6ZOQDXrcI+3QsTwmeC4hCCgnTXAN4Na/T3JNMSYKi4ZAj794BrCGUhBIUIEbgV/rI+lS0v+znDcqEwhKAAH/xz/e7z53IshQlPruNuOjgTuEYInPvjk/VH64ulQKlWYf/vsFTwjRA4Fa8HhItvnzq7IDgWMXCOEDgUIxD+Yh7LxbsBaxFj8FaIwanAHULgTKURUGfdZEAMnCEEjlQeAUUMHCIETjQSAUUMnCEEDjQWAUUMHCEEM2s0AooYOEEIZtR4BBQxcIAQzIQIXEEMZkYIZkAENiIGMyIEmRGBnYjBTAhBRkSgF2IwA0KQCREYhBhkRggyIAKjEIOMCEFiRGASYpAJIUiICJggBhkQgkSIgClikNgNgbnlF0TA2PnPM963UZAEITAWIxDOXo+ffEcELH33XA7++o08Dj9ffq4JsDQwpBGQbhK4+bOLDdOECMjf/nfxGJyFJ+2dkzdYJlgiBEauR0ARg2muRUARA2OEwMC2CChiMM6WCChiYIgQTLQvAooYDLMnAooYGCEEE/SNgCIG/fSMgCIGBgjBSEMjoIjBbgMjoIjBRIRghLERUMRgs5ERUMRgAkIw0NQIKGJw1cQIKGIwEiEYwCoCihhcMIqAIgYjEIKerCOgWo+BcQQUMRiIEPSQKgKq1RgkioAiBgMQgj1SR0C1FoPEEVDEoCdCsEOuCKhWYpApAooY9EAItsgdAVV7DDJHQBGDPQjBBnNFQNUag5kioIjBDoTgmrkjoGqLwcwRUMRgC0JwiZcIqFpi4CQCihhsQAg63iKgSo+BswgoYnANIRC/EVClxsBpBBQxuKT5EHiPgCotBs4joIhBp+kQlBIBVUoMComAIgbScAhKi4DyHoPCIqCaj0GTISg1AsprDAqNgGo6Bs2FoPQIKG8xKDwCqtkYNBWCWiKgvMSgkgioJmPQTAhqi4CaOwaVRUA1F4MmQlBrBNRcMag0AqqpGFQfgtojoHLHoPIIqGZiUHUIWomAyhWDRiKgmohBtSFoLQIqdQwai4CqPgZVhqDVCKhUMWg0AqrqGFQXgtYjoKxj0HgEVLUxqCoEROAqqxgQgSuqjEE1ISACm02NARHYqLoYVBECIrDb2BgQgZ2qikHxISAC/QyNARHopZoYFB0CIjBM3xgQgUGqiEGxISAC4+yLAREYpfgYFBkCIjDNthgQgUmKjkFxISACNq7HgAiYKDYGRYWACNjSGBABU0XGoJgQEIE0Xv2JyL+fEQFjxcWgiBAQgUSehu0/Yft52F4R2CoqBu5DQAQS0Qg86/75FSEG9oqJgesQEIFErkdAEYMUioiB2xAQgUS2RUARgxTcx8BlCIhAIvsioIhBCq5j4C4ERCCRvhFQxCAFtzFwFQIikMjQCChikILLGLgJARFIZGwEFDFIwV0MXISACCQyNQKKGKTgKgazh4AIJGIVAUUMUnATg1lDQAQSsY6AIgYpuIjBbCEgAomkioAiBinMHoNZQkAEEkkdAUUMUpg1BtlDQAQSyRUBRQxSmC0GWUNABBLJHQFFDFKYJQbZQkAEEpkrAooYpJA9BllCQAQSmTsCihikEGPwRojBSjK4IRkQgQS8RCD6tttg6fzkGU6ih5JB8hD86ov1R0IEbHmKgCIGKRx2MTiQxJKGIETgfhhv3hPY8RgBRQxSiDH4RBJLdo0gjjThD/BEYMdzBC7jmoG5cKDeC9cLjiWRZBNBd10AVkqJQMRkYC4cT/dTXi9IEoK4JAgPhwIbJUVAEQNrBymXCOZLA5YExkqMwGUsE0ylWiLYTwQLuS+wUXoEIiYDU90SwfxVBNMQnE8Da7krmK6GCChiYClGwPyVONuJgGnARk0RUMTATJgK3rWeCsxCwDRgpMYIKGJgJUbgrhiymwiYBqarOQKKGJgIU8FvxJBZCMI0sBSM10IEFDGwsAxT+FKMmIQg7NCbwvsGxmspAooYWHhTjNhMBAvbMaUpLUZAEYNJwvLgbTFiEgKWBSO1HAFFDKY4CNO4yW/2Tg5BtyOHgmGIwI+IwRRLMWAxESwFwxCBFxGDsZZiwCIEtwX9EYHtiMFg4TrB62JgcgjWF29uQB9EYD9iMNShxbsMLSYCbkPWBxHojxgMdSgTTQpBVyImgn2IwHDEYIjJJ+OpE8GhYDciMB4x6Gv2pQHTwC5EYDpi0IeLawTYhAjYIQbJEYIUiIA9YrBVeOXuNZmIEFgjAukQg40WIl/LRITAEhFIjxhsciYTTQ3B5B2oBhHIhxiYIwQWiEB+xOCylUw0KQS5PrLZNSIwH2KgVjLR5GsEC4OdKBYRmB8xiFYykcXFws+lRUTAj7ZjcGYxmVuE4FRaQwT8aTQGC6PjjxAMRQT8ajMGX4oBqxC08eoBEfCvvRh8JgYmhyCsT2IE6p8KiEA52olBvD5wIgZM3lkY1il/lpoRgfK0EQOTaSCyeovxQ6l1eUAEylV5DCxPwCYhqHZ5QATKV28MVuG4czcRxDo9kJoQgXrUGYMTMWQWgu6ixYnUgAjUp7IYWJ94TX8NuYqpgAjUq54YPLT+PR/TEBQ/FRCB+lUQgxQnXPMbkxQ7FRCBdhQcg3h8pfitX/MQdFOB2dXMLIhAe8qMwSpsx5JAkluVhWrdk1LeV0AE2lVYDLppIMlxlSQEcXQpYolABFBODOIFwoeSSLKbl4adPg4x+Fi8IgJQ/mOw6qbsZFLfxfhIPL7jkAjgOr8xOAsRuJNqSaCShiDufPhDvCWebmdGBLCNwxiE4+edHPcGTf65Bt31gjvi4eIhEcA+jmIQlwOWv0+wS5YPOHERAyKAvhzEoHuFIMlLhVu+Xz7LL9a31iKPJfenKBMBjPFKt2XWReBIMsoagih7DIgApsgcgzki0H3f/LLFgAjAQqYYzBWB7nvPI3kMiAAsJY7BnBHovv98ksWACCCFRDGYOwLdPszLPAZEACkZx8BDBLr9mJ9ZDIgAcjCKgZcIRC5CEE2OARFAThNj4CkCkZsQRKNjQAQwh5Ex8BaByFUIosExIAKY08AYeIxA5C4EUe8YEAF40DMGXiMQuQxBtDcGRACe7ImB5whEbkMQbY0BEYBHW2LgPQKR6xBEL8SACMCzazEoIQKR+xBEP8TgaYgBEYB3XQxKiUCU5X4EU4Uf5un5/Qz+K2dEwNj/Bda+DRH4ppwIREWEIDqPwVMndzqqxVdh+zJs/xIYWjwPEbhdTgSiIpYGly3/MtPNTWoTI/D3S//8y7C9KpjoPAK/LisCUXEhiIjBRNcjoIjBJKVGICoyBBExGGlbBBQxGKXkCETFhiAiBgPti4AiBoOUHoGo6BBExKCnvhFQxKCXGiIQFR+CiBjsMTQCihjsVEsEoipCEBGDLcZGQBGDjWqKQFRNCCJicM3UCChicEVtEYiqCkFEDDpWEVDE4FyNEYiqC0HUfAysI6Aaj0GtEYiqDEHUbAxSRUA1GoOaIxBVG4KouRikjoBqLAa1RyCqOgRRMzHIFQHVSAxaiEBUfQii6mOQOwKq8hi0EoGoiRBE1cZgrgioSmPQUgSiZkIQVReDuSOgKotBaxGImgpBVE0MvERAVRKDFiMQNReCqPgYeIuAKjwGrUYgajIEUbEx8BoBVWgMWo5A1GwIouJi4D0CqrAYtB6BqOkQRMXEoJQIqEJiQAQuNB+CyH0MSouAch4DIvAjQtBxG4NSI6CcxoAIXEUILnEXg9IjoJzFgAi8iBBc4yYGtURAOYkBEdiMEGwwewxqi4CaOQZEYDtCsMVsMag1AmqmGBCB3QjBDtljUHsEVOYYEIH9CMEe2WLQSgRUphgQgX4IQQ/JY9BaBFTiGBCB/ghBT8li0GoEVKIYEIFhCMEA5jFoPQLKOAZEYDhCMJBZDIjAVUYxIALjEIIRJseACGw2MQZEYDxCMNLoGBCB3UbGgAhMQwgmGBwDItDPwBgQgekIwUS9Y0AEhukZAyJggxAY2BsDIjDOnhgQATuEwMjWGBCBabbEgAjYIgSGXogBEbBxLQZEwB4hMPZDDL4KMSACdroYEIE0CEECy09CDP4RYrBu7CPZE1v8IkTgt0QghRsCcyfvLE4XL8mdkNkzgYlwxiICCTERJLQ8CpPBMyaDqc4j8CcikBIhSIwYTEME8iAEGRCDcYhAPoQgE2IwDBHIixBkRAz6IQL5EYLMiMFuRGAehGAGxGAzIjAfQjATYnAVEZgXIZgRMbhABOZHCGbWegyIgA+EwIFWY0AE/CAETrQWAyLgCyFwpJUYEAF/CIEztceACPhECByqNQZEwC9C4FSIwWEXg0OpwGIt904+XBwLXCIEjlURg4WchQi8FSaBE4Fb3KHIsZOjxWrxkrwRav1ISrSQ8/0nAv4xERRi+fv10VrkvhQiPLE+lpflKMSM27UVgBAUpIilQpwC1vIOU0BZCEGBlu+v755PB56CcHEtIE4Bx0wB5SEEBTtfLizk7dmDsJCH4VrAg3hNQ1AkQlCBWSYEJoCqEIKKhAlhGR7uhinhdpIoxINf5LPw/34UAnBKAOpBCCoV350oz2QZvrwdpoVbo8JwcdY/DV99KTEAHPzVIgSNCGE4kKchCPEDWhchCvr25YW8Fr7+Onx1cYA/l5XcCNvLsmLNDwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0K7vAU7PQZUgFNryAAAAAElFTkSuQmCC";

/**
 * Embedded, for the stdio package, which runs on the person's machine and
 * has no URL of its own. The hosted server links to `/mcp/icon.png`
 * instead, because revision 2026-07-28 repeats the server's identity in
 * every result and an embedded image would ride along on each one.
 */
export const ICONS = [
  {
    src: `data:image/png;base64,${ICON_PNG_BASE64}`,
    mimeType: "image/png",
    sizes: ["258x258"],
  },
];

/**
 * ChatGPT's line under a running tool, then under a finished one
 * (`openai/toolInvocation/invoking` and `invoked`, 64 characters at most).
 * Other clients ignore these keys. Present tense while it runs, past once
 * done, and never a number: the text is fixed per tool, not per call.
 */
export const STATUS = {
  list_workspaces: [
    "Looking up your Skyelight workspaces",
    "Found your workspaces",
  ],
  list_projects: ["Looking up Skyelight projects", "Found your projects"],
  list_items: ["Reading Skyelight feedback", "Read the feedback"],
  search_items: ["Searching Skyelight feedback", "Searched the feedback"],
  get_item: ["Opening the thread", "Opened the thread"],
  list_members: ["Looking up the team", "Found the team"],
  post_update: ["Replying on the thread", "Replied on the thread"],
  create_item: ["Creating a thread", "Created the thread"],
  set_status: ["Updating the thread", "Updated the thread"],
  assign: ["Assigning the thread", "Assigned the thread"],
  project_review: [
    "Reading the project's history",
    "Read the project's history",
  ],
  whats_new: ["Checking what's new", "Caught up"],
  find_by_source: ["Finding feedback by file", "Found feedback by file"],
  find_similar: ["Checking for similar reports", "Checked for similar reports"],
  merge_items: ["Merging duplicates", "Merged the duplicates"],
  decision_log: ["Reading the decisions", "Read the decisions"],
  save_rule: ["Saving the rule", "Saved the rule"],
  publish_review_link: ["Publishing to Skyelight", "Published to Skyelight"],
};
