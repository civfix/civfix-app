import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { DataTable } from "./data-table"
import { useSelection } from "./use-selection"
import type { DataTableColumn, SortState } from "./data-table"

interface Row {
  id: string
  name: string
  extra: string
}

const ROWS: Row[] = [
  { id: "r1", name: "Ann", extra: "a" },
  { id: "r2", name: "Bo", extra: "b" },
  { id: "r3", name: "Cy", extra: "c" },
  { id: "r4", name: "Dee", extra: "d" },
]

const COLUMNS: DataTableColumn<Row>[] = [
  { id: "name", label: "Name", render: (row) => row.name, sortable: true },
  { id: "extra", label: "Extra", render: (row) => row.extra, columnPriority: 3 },
]

function Harness({
  sort,
  onSortChange,
  onRowPress,
  withSelection,
  maxColumnPriority,
  renderCard,
}: {
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
  onRowPress?: (row: Row) => void
  withSelection?: boolean
  maxColumnPriority?: number
  renderCard?: (row: Row) => ReactNode
}) {
  const selection = useSelection(ROWS.map((row) => row.id))
  return (
    <>
      <DataTable
        caption="Attendees"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        sort={sort ?? null}
        onSortChange={onSortChange}
        selection={withSelection ? selection : undefined}
        rowSelectLabel={(row) => `Select ${row.name}`}
        onRowPress={onRowPress}
        rowPressLabel={(row) => `Open ${row.name}`}
        maxColumnPriority={maxColumnPriority}
        renderCard={renderCard}
      />
      <output data-testid="selected">{[...selection.selectedIds].sort().join(",")}</output>
    </>
  )
}

describe("DataTable", () => {
  it("publishes aria-sort on every column header and marks the active one", () => {
    renderConsole(<Harness sort={{ columnId: "name", dir: "asc" }} onSortChange={() => {}} />)
    const headers = screen.getAllByRole("columnheader")
    expect(headers.map((header) => header.getAttribute("aria-sort"))).toEqual([
      "ascending",
      "none",
    ])
  })

  it("flips the direction on a second activation of the same column", async () => {
    const onSortChange = vi.fn()
    const user = userEvent.setup()
    renderConsole(<Harness sort={{ columnId: "name", dir: "asc" }} onSortChange={onSortChange} />)
    await user.click(screen.getByRole("button", { name: /Name/ }))
    expect(onSortChange).toHaveBeenCalledWith({ columnId: "name", dir: "desc" })
  })

  it("gives every row a real focusable control rather than a click-only <tr>", async () => {
    const onRowPress = vi.fn()
    const user = userEvent.setup()
    renderConsole(<Harness onRowPress={onRowPress} />)
    const control = screen.getByRole("button", { name: "Open Ann" })
    control.focus()
    expect(document.activeElement).toBe(control)
    await user.keyboard("{Enter}")
    expect(onRowPress).toHaveBeenCalledWith(ROWS[0])
  })

  it("selects a contiguous range on a shift-click without toggling one row at a time", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness withSelection />)
    await user.click(screen.getByRole("checkbox", { name: "Select Ann" }))
    expect(screen.getByTestId("selected").textContent).toBe("r1")
    await user.keyboard("{Shift>}")
    await user.click(screen.getByRole("checkbox", { name: "Select Dee" }))
    await user.keyboard("{/Shift}")
    expect(screen.getByTestId("selected").textContent).toBe("r1,r2,r3,r4")
  })

  it("select-all toggles every visible row and then clears", async () => {
    const user = userEvent.setup()
    renderConsole(<Harness withSelection />)
    const all = screen.getByRole("checkbox", { name: "table.select_all" })
    await user.click(all)
    expect(screen.getByTestId("selected").textContent).toBe("r1,r2,r3,r4")
    await user.click(all)
    expect(screen.getByTestId("selected").textContent).toBe("")
  })

  it("drops columns above the priority ceiling", () => {
    const { unmount } = renderConsole(<Harness maxColumnPriority={2} />)
    expect(screen.getAllByRole("columnheader")).toHaveLength(1)
    expect(screen.queryByText("Extra")).toBeNull()
    unmount()
    renderConsole(<Harness maxColumnPriority={3} />)
    expect(screen.getAllByRole("columnheader")).toHaveLength(2)
  })

  it("renders cards instead of a table on a narrow viewport", () => {
    const matchMedia = window.matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("max-width: 767px"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    renderConsole(
      <Harness renderCard={(row) => <article data-testid="card">{row.name}</article>} />,
    )
    expect(screen.queryByRole("table")).toBeNull()
    const cards = screen.getAllByTestId("card")
    expect(cards).toHaveLength(ROWS.length)
    expect(within(cards[0] as HTMLElement).getByText("Ann")).toBeTruthy()
    Object.defineProperty(window, "matchMedia", { writable: true, value: matchMedia })
  })

  it("names the table for assistive tech with a caption", () => {
    renderConsole(<Harness />)
    expect(screen.getByRole("table", { name: "Attendees" })).toBeTruthy()
  })
})
