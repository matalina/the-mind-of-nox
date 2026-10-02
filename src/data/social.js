// Social / link icons rendered in the site header and footer.
// Fill in the real URLs below — entries marked CHANGE_ME / "#" are placeholders.
// `icon` is a filename in src/assets/images/icons/ (served from /images/icons/).
export default {
  // Header row, displayed above the dateline (in this order).
  header: [
    { name: "rss",       label: "RSS feed",  icon: "rss.svg",       url: "/feed/index.xml" },
    { name: "email",     label: "Email",     icon: "email.svg",     url: "mailto:nox.durante@gmail.com" },
    { name: "discord",   label: "Discord",   icon: "discord.svg",   url: "https://discord.gg/JGM7vfZ4D5" },
    { name: "facebook",  label: "Facebook",  icon: "facebook.svg",  url: "https://www.facebook.com/the.mind.of.nox" },
    { name: "instagram", label: "Instagram", icon: "instagram.svg", url: "https://www.instagram.com/the.mind.of.nox" },
    { name: "bluesky",   label: "Bluesky",   icon: "bluesky.svg",   url: "https://bsky.app/profile/themindofnox.com" },
    { name: "wordpress", label: "WordPress", icon: "wordpress.svg", url: "https://themindofnox.wordpress.com" },
    { name: "youtube",   label: "YouTube",   icon: "youtube.svg",   url: "https://www.youtube.com/@TheMindofNox" },
  ],
  // Footer "built with" row — replaces the old colour legend (bottom-right).
  footer: [
    { name: "11ty",     label: "Built with 11ty",      icon: "11ty.svg",     url: "https://www.11ty.dev/" },
    { name: "dabble",   label: "Written in Dabble",    icon: "dabble.png",   url: "https://accounts.dabblewriter.com/auth/signup?referralCode=2JOJMDMK" },
    { name: "obsidian", label: "Authored in Obsidian", icon: "obsidian.svg", url: "https://obsidian.md/" },
  ],
};
