import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'

function App() {
	const [num, setNum] = useState(100)

	const arr =
		num % 2 === 0
			? [
					<li key="1">
						1<div>1</div>
					</li>,
					<li key="2">2</li>,
					<li key="3">3</li>
			  ]
			: [
					<li key="3">3</li>,
					<li key="2">2</li>,
					<li key="1">
						1<div>{num}</div>
					</li>
			  ]

	return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>
}

// function Child() {
// 	return <span>mini-react</span>
// }

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
