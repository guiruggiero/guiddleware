// Import
import {createRetryClient} from "./axiosClient.js";

// Axios instance for Trello API
const trelloClient = createRetryClient({
  baseURL: "https://api.trello.com/1",
  timeout: 8000,
  params: {
    key: process.env.TRELLO_API_KEY,
    token: process.env.TRELLO_TOKEN,
  },
});

// Board and its ordered lists are fixed for this personal setup
const BOARD_ID = "667c0d6a03c990598e49744a";
const LISTS = [
  {key: "inbox", name: "Inbox", id: "6a79f64abeebb58c183a0be4"},
  {key: "todo", name: "To-do", id: "667c0d70d12671cfe4675edb"},
  {key: "prioritized", name: "Prioritized", id: "66c22f736b222b119f05d8cf"},
  {key: "doing", name: "Doing", id: "667c0d74ef0fad8560db26de"},
  {key: "waiting", name: "Waiting", id: "66c1f9537b28760c567ace48"},
  {key: "done", name: "Done", id: "667c0d77db9852b22e296545"},
  {key: "habits", name: "Habits", id: "66d1a26e6bd289b217bffbf6"},
];

// Precomputed lookups and commonly needed constants
const listByKey = new Map(LISTS.map((l) => [l.key, l]));
const listById = new Map(LISTS.map((l) => [l.id, l]));
const doneListId = listByKey.get("done").id;

// Creates a card in a named list
export const createCard = async (listKey, name, description) => {
  const list = listByKey.get(listKey);
  if (!list) throw new Error(`Unknown Trello list: ${listKey}`);

  const res = await trelloClient.post("/cards", null, {
    params: {idList: list.id, name, desc: description},
  });

  return res.data;
};

// Updates title, prepends a note to description, and/or moves lists
export const updateCard = async (cardId, {
  name, note, list, direction,
} = {}) => {
  const params = {};
  if (name !== undefined) params.name = name;

  // Both a note and a relative move need the card's current state first
  const needsCurrent = note !== undefined ||
    (list === undefined && direction !== undefined);
  const current = needsCurrent ?
    (await trelloClient.get(
      `/cards/${cardId}`, {params: {fields: "desc,idList"}})).data :
    null;

  if (note !== undefined) {
    params.desc = `[bot] ${note}\n---\n${current.desc}`;
  }

  if (list !== undefined) {
    const target = listByKey.get(list.toLowerCase());
    if (!target) throw new Error(`Unknown Trello list: ${list}`);
    params.idList = target.id;
  } else if (direction !== undefined) {
    const idx = LISTS.findIndex((l) => l.id === current.idList);
    const target = LISTS[idx + (direction === "right" ? 1 : -1)];
    if (!target) {
      const end = direction === "right" ? "last" : "first";
      throw new Error(`Card is already at the ${end} list`);
    }
    params.idList = target.id;
  }

  const res = await trelloClient.put(`/cards/${cardId}`, null, {params});
  return res.data;
};

// Full-text search for card titles, excluding "Done"
export const searchCards = async (query, limit = 10) => {
  const res = await trelloClient.get("/search", {
    params: {
      query,
      idBoards: BOARD_ID,
      modelTypes: "cards",
      card_fields: "name,desc,shortUrl,idList",
      cards_limit: Math.min(limit * 3, 100), // buffer for the Done filter
      partial: true, // otherwise misses obvious substring matches
    },
  });

  return res.data.cards
    .filter((card) => card.idList !== doneListId)
    .slice(0, limit)
    .map(({id, name, desc, shortUrl, idList}) => ({
      id, name, description: desc, url: shortUrl,
      list: listById.get(idList)?.name ?? idList,
    }));
};
