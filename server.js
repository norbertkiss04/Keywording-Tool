const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

const apiKey = process.env.API_KEY;
const url = "https://api.together.xyz/v1/chat/completions";

const sendRequests = async (contents) => {
  const requests = contents.map((content) => {
    const data = {
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      max_tokens: 512,
      temperature: 0.88,
      top_p: 0.37,
      top_k: 100,
      repetition_penalty: 1.18,
      messages: [{ role: "user", content: content }],
    };

    return axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  });

  try {
    const responses = await Promise.all(requests);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return responses.map((response) => response.data);
  } catch (error) {
    console.error("Error in concurrent requests:", error);
    return [];
  }
};

app.get("/", async (req, res) => {
  const imageTitle = req.query.title;

  const contents = [
    `Create a list of 25 keywords 1 word for a stock photo titled '${imageTitle}'. Ensure each keyword is unique and directly describes the image, balancing how competitive they are. Avoid subjective or vague terms. Ensure the responses adhere to the RFC8259 compliant JSON format without modifications. Follow this exact structure: {\"keywords\": [\"kw1\", \"kw2\", \"kw3\", ..., \"kw25\"]. Do NOT respond anything other than the json.`,
    `Ensure a list of 20 2 word unique and descriptive keywords for a stock photo titled '${imageTitle}' involves focusing on specific aspects of the scene. The aim is to balance the distinctiveness of each keyword while maintaining relevance to the image. Ensure the responses adhere to the RFC8259 compliant JSON format without modifications. Follow this exact structure: {\"keywords\": [\"kw1\", \"kw2\", \"kw3\", ..., \"kw20\"]." Do NOT respond anything other than the json.`,
  ];

  try {
    const results = await sendRequests(contents);

    if (results.length === 2) {
      const processKeywords = (keywords) => {
        return keywords
          .map((keyword) => keyword.toLowerCase())
          .map((keyword) => keyword.replace(/[^a-zA-Z]/g, " "));
      };

      const keywords1 = processKeywords(
        JSON.parse(results[0].choices[0].message.content).keywords
      );
      const keywords2 = processKeywords(
        JSON.parse(results[1].choices[0].message.content).keywords
      );

      const mergedKeywords = [...keywords1, ...keywords2];

      const string1 =
        "You'll receive the title of a stock photography image, along with a list of keywords associated with it. Your job is to rearrange these keywords so that they are ordered by relevance. The most descriptive and relevant keywords to the image should be placed at the beginning of the list. You have to return every single keyword.";
      const string2 = `Title: '${imageTitle}'`;
      const string4 =
        'Ensure the responses adhere to the RFC8259 compliant JSON format without modifications. {"keywords": ["kw1", "kw2", "kw3", ..., "kw45"]}. Do NOT respond anything other than the json.';

      const combinedString = `${string1}\n\n${string2}\n\nKeywords: ${mergedKeywords}\n\n${string4}`;

      const rearrangePrompt = [combinedString];
      const rearrangedResults = await sendRequests(rearrangePrompt);

      if (
        rearrangedResults[0] &&
        rearrangedResults[0].choices &&
        rearrangedResults[0].choices[0] &&
        rearrangedResults[0].choices[0].message &&
        rearrangedResults[0].choices[0].message.content
      ) {
        const rearrangedKeywords = JSON.parse(
          rearrangedResults[0].choices[0].message.content
        ).keywords;
        res.json(rearrangedKeywords);
      } else {
        res
          .status(500)
          .json({ error: "Invalid response from the rearranging API" });
      }
    } else {
      res
        .status(500)
        .json({ error: "Invalid response from the initial API requests" });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
