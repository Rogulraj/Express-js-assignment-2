const express = require("express");
const exp = express();
exp.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const bcrypt = require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");

const connectingToDb = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    exp.listen(3000, () => {
      console.log("Current Running Server http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
connectingToDb();

//Authentication:
const authentication = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtTokenVerify;
  if (authHeader !== undefined) {
    jwtTokenVerify = authHeader.split(" ")[1];
  }
  if (jwtTokenVerify === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtTokenVerify, "DARK_HOLE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Inserting Values (POST):API-1
exp.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;

  const checkingUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
  `;
  const checkingUser = await db.get(checkingUserQuery);
  if (checkingUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const bcryptPassword = await bcrypt.hash(password, 10);

      const insertQuery = `
            INSERT INTO
                user (name, username, password, gender)
            VALUES
                ('${name}', '${username}', '${bcryptPassword}', '${gender}');
        `;
      const inserting = await db.run(insertQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//LogIn using
exp.post("/login/", authentication, async (request, response) => {
  const { username, password } = request.body;

  const checkLoginUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;
  const checkLoginUser = await db.get(checkLoginUserQuery);
  if (checkLoginUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const validatePassword = await bcrypt.compare(
      password,
      checkLoginUser.password
    );
    if (validatePassword === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "DARK_HOLE");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Return Tweets of follower
exp.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  const userDetailQuery = `
  SELECT *
  FROM user 
  WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const tweetDetailQuery = `
    SELECT user.username, tweet, tweet.date_time AS dateTime
    FROM follower LEFT JOIN tweet ON follower.following_user_id = tweet.user_id LEFT JOIN user ON tweet.user_id = user.user_id
    WHERE follower.follower_user_id = ${userDetail.user_id}
  `;
  const tweetDetail = await db.all(tweetDetailQuery);
  response.send(tweetDetail);
});

//Return the list of following
exp.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;
  const userDetailQuery = `
  SELECT *
  FROM user 
  WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const followingListQuery = `
    SELECT 
        name
    FROM
        follower LEFT JOIN user ON follower.following_user_id = user.user_id
    WHERE
        follower.follower_user_id = ${userDetail.user_id};
  `;
  const followingList = await db.all(followingListQuery);
  response.send(followingList);
});

//Return the list of following
exp.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;
  const userDetailQuery = `
  SELECT *
  FROM user 
  WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const followersListQuery = `
    SELECT 
        name
    FROM
        follower LEFT JOIN user ON follower.follower_user_id = user.user_id
    WHERE
        follower.following_user_id = ${userDetail.user_id}
  `;
  const followersList = await db.all(followersListQuery);
  response.send(followersList);
});

//Return the tweet using following ID
exp.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const userDetailQuery = `
  SELECT *
  FROM user 
  WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const tweetDetailQuery = `
    SELECT *
    FROM follower LEFT JOIN tweet ON follower.following_user_id = tweet.user_id
    WHERE follower.follower_user_id = ${userDetail.user_id} AND tweet.tweet_id = ${tweetId};
  `;
  const tweetDetail = await db.get(tweetDetailQuery);

  if (tweetDetail === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const likeCountQuery = `
        SELECT COUNT(*) AS likes
        FROM like
        WHERE tweet_id = ${tweetId};
      `;
    const likeCount = await db.get(likeCountQuery);

    const replyCountQuery = `
        SELECT COUNT(*) AS replies
        FROM reply
        WHERE tweet_id = ${tweetId};
      `;
    const replyCount = await db.get(replyCountQuery);

    const sendingResponse = {
      tweet: tweetDetail.tweet,
      likes: likeCount.likes,
      replies: replyCount.replies,
      dateTime: tweetDetail.date_time,
    };
    response.send(sendingResponse);
  }
});

// Return the Like using following ID
exp.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const userDetailQuery = `
        SELECT *
        FROM user 
        WHERE user.username = '${username}';
  `;
    const userDetail = await db.get(userDetailQuery);

    const tweetDetailQuery = `
    SELECT *
    FROM follower LEFT JOIN tweet ON follower.following_user_id = tweet.user_id
    WHERE follower.follower_user_id = ${userDetail.user_id} AND tweet.tweet_id = ${tweetId};
  `;
    const tweetDetail = await db.get(tweetDetailQuery);
    if (tweetDetail === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likedTweetQuery = `
            SELECT username
            FROM tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id LEFT JOIN user ON like.user_id = user.user_id
            WHERE tweet.tweet_id = ${tweetId};
        `;
      const likedTweet = await db.all(likedTweetQuery);

      let listOfUser = [];

      likedTweet.forEach((val) => {
        listOfUser.push(val.username);
      });
      response.send({ likes: listOfUser });
    }
  }
);

exp.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const userDetailQuery = `
        SELECT *
        FROM user 
        WHERE user.username = '${username}';
  `;
    const userDetail = await db.get(userDetailQuery);

    const tweetDetailQuery = `
        SELECT *
        FROM follower LEFT JOIN tweet ON follower.following_user_id = tweet.user_id
        WHERE follower.follower_user_id = ${userDetail.user_id} AND tweet.tweet_id = ${tweetId};
  `;

    const tweetDetail = await db.get(tweetDetailQuery);

    if (tweetDetail === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replyTweetQuery = `
            SELECT name, reply
            FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id LEFT JOIN user ON reply.user_id = user.user_id
            WHERE tweet.tweet_id = ${tweetId};
        `;
      const replyTweet = await db.all(replyTweetQuery);
      response.send({ replies: replyTweet });
    }
  }
);

//
exp.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;

  const userDetailQuery = `
        SELECT *
        FROM user 
        WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const allTweetDetailsQuery = `
    SELECT
        DISTINCT tweet, COUNT(DISTINCT like_id) AS likes, COUNT(reply_id) AS replies, date_time AS dateTime
    FROM
        tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id LEFT JOIN reply ON like.tweet_id = reply.tweet_id
    WHERE
        tweet.user_id = ${userDetail.user_id}
    GROUP BY
        tweet.tweet_id;
  `;
  const allTweetDetails = await db.all(allTweetDetailsQuery);
  response.send(allTweetDetails);
});

//post tweet
exp.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;

  const postTweetQuery = `
    INSERT INTO
        tweet (tweet)
    VALUES
        ('${tweet}');
  `;
  const postTweet = await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//delete
exp.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const userDetailQuery = `
        SELECT *
        FROM user 
        WHERE user.username = '${username}';
  `;
  const userDetail = await db.get(userDetailQuery);

  const deleteConfirmationQuery = `
        SELECT
            *
        FROM
            tweet
        WHERE
            tweet.user_id = ${userDetail.user_id} AND tweet_id = ${tweetId};
    `;
  const deleteConfirmation = await db.get(deleteConfirmationQuery);

  if (deleteConfirmation === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `
    DELETE FROM
        tweet
    WHERE
        tweet.tweet_id = ${tweetId};
    `;
    const deleting = await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
});
module.exports = exp;
