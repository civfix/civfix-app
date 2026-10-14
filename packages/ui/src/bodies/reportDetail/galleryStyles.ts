import { makeThemedStyles } from "../../theme"

export const GALLERY_ASPECT_RATIO = 16 / 10

export const useGalleryStyles = makeThemedStyles((t) => ({
  gallery: {
    marginTop: t.space["4"],
  },
  heroWrap: {
    position: "relative",
  },
  heroMedia: {
    width: "100%",
  },
  heroPress: {
    borderRadius: t.radius.lg,
  },
  photoReportBtn: {
    position: "absolute",
    top: t.space["2"],
    right: t.space["2"],
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  stripScroll: {
    marginTop: t.space["2"],
  },
  strip: {
    flexDirection: "row",
    gap: t.space["2"],
    paddingVertical: 2,
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: t.radius.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: t.colors.border,
    backgroundColor: t.colors.neutral.paper2,
  },
  thumbActive: {
    borderColor: t.colors.brand.bloom,
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  thumbVideoBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  thumbStatus: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
    borderColor: t.colors.border,
  },

  statusHero: {
    width: "100%",
    aspectRatio: GALLERY_ASPECT_RATIO,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
  },
  statusHeroText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

  processingBlock: {
    width: "100%",
    aspectRatio: GALLERY_ASPECT_RATIO,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bgAlt,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["5"],
  },
  processingTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
    textAlign: "center",
  },
  processingBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: t.colors.textSubtle,
    textAlign: "center",
  },
}))
