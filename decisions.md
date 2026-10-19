## Why
Creating an app that I can use in the homelab infrastructure I am building out

## App-choice
Game Tracker
Creating something that interested me, since videogames are my hobby I thought a game tracker might be fun

## Design Decisions
This app will track the games on a users wishlist / backlog that they want to play.  And will show completed games as well.

- Login page so that multiple users can track their games
- Games will be sorted into a filterable list, so a user can quickly find games by platform or status
- Games will have one platform per entry and will be grouped per platform.  To keep it simple, will allow multiple entries under different systems
- Each game can be clicked on for more details
- Will start with manual entry so the app works without any outside service, but may do an autofill of information from an external database

## Out of scope (for now)
- Stats page
- Collection tracker (store, price paid)
- Shared or social lists