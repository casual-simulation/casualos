# Xp API Developers

### 〘 Xp API – Developer Reference 〙

---

### Table of Contents

| Section                            | Description                                                              |
| ---------------------------------- | ------------------------------------------------------------------------ |
|                                    |                                                                          |
| [Terminology](#terms)              | Defines, clarifies, and describes relevant terminology and its usage.    |
| [What Is](#about)                  | An about section, pertaining to the Xp API                               |
| [Programmatic Comments](#comments) | Describes comment prefixes and their niche in the Xp API implementation. |
| [Notes](#notes)                    | Development content.                                                     |

---

### Terms

_Note:_
Abbreviations should only be made on noun forms of their respective words.
Verbs (action) should be directly and completely specified at source, without need for terminology reference.
Shortenings do not need to contain a period (.) but are documented in [Terms](#terms) with; for sake of respect to multiple
national language norms (American & British English).

| Term   | Reference                         | Context?                                                   |
| ------ | --------------------------------- | ---------------------------------------------------------- |
| Impl.  | Abbreviation for "Implementation" |
| Ref.   | Abbreviation for "Reference"      |
| &\|    | Symbolic equivalent to "and / or" | "&" = "and", "\|" = "or"                                   |
| Async. | Abbreviation for "asynchronous"   |
| XPA    | Acronym for "Xp API"              | The programmatic implementation supporting the XP Exchange |
| XPE    | Acronym for "Xp Exchange"         | The system which utilizes the Xp API                       |

---

### About

In Development!

```ts
/**
 * TODO: Add about section to developers md
 */
```

---

### Comments

While not necessary, the usage of comment prefixes (which suffix the programmatic comment symbols), (grouping) is highly advised in any continuation of production within the XPA codebase.

Comment prefixes serve to optimize development communication through the asynchronous and mono-static means—presented by programmatic comments.

They (comment prefixes) do so by organizing comments via their niche, which enables the parsing / querying of relevant &| related comments.

The prefix system-standard that will appear in the XPA codebase is directly inspired by:
[Aaron Bond - Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments)

Although this is not a recognized standard by orgs like (ISO, IEEE, etc...);
it is fairly popular (generally understood / accepted), due to the aforementioned optimizations.

In summary the prefixes and their niche assertions on comments are as follows:

| Prefix | Niche Assertion    |
| ------ | ------------------ |
| !      | Alerts             |
| //     | Commented Out Code |
| \*     | Highlights         |
| ?      | Queries            |
| TODO:  | To-dos             |

##### Comment example:

```ts
// ! This will break
/**
 * ? Why is the spread operator the only code within the function scope?
 * // function countUp(objRef, prop, quant) {...}
 * * This function impl needs work
 */
// TODO: Fix function countUp
```

---
