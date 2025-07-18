import React, { useState, useEffect, createContext } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Package,
  Truck,
  PlusCircle,
  Edit,
  Trash2,
  Search,
  XCircle,
  Loader2,
} from "lucide-react"; // Icons
import { firebaseConfig } from "./firebaseConfig";

// Context for Firebase and Auth
const AppContext = createContext(null);

const appId = "coordinator-cargo";

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-4">
    <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
    <span className="ml-2 text-gray-700">Loading...</span>
  </div>
);

const MessageBox = ({ message, type, onClose, onConfirm }) => {
  if (!message) return null;

  const bgColor =
    type === "error"
      ? "bg-red-100 border-red-400 text-red-700"
      : type === "success"
      ? "bg-green-100 border-green-400 text-green-700"
      : "bg-blue-100 border-blue-400 text-blue-700";
  const borderColor =
    type === "error"
      ? "border-red-500"
      : type === "success"
      ? "border-green-500"
      : "border-blue-500";

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div
        className={`relative ${bgColor} border ${borderColor} px-4 py-3 rounded-lg shadow-lg max-w-sm w-full`}
      >
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-lg">
            {type === "confirm" ? "Confirm Action" : "Notification"}
          </p>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <p className="text-sm">{message}</p>
        {type === "confirm" && (
          <div className="flex justify-end mt-4 space-x-2">
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Yes
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
            >
              No
            </button>
          </div>
        )}
        {type !== "confirm" && (
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CargoForm = ({ cargo, onSubmit, onCancel, setMessageBox }) => {
  // Added setMessageBox as a prop
  const [consignee, setConsignee] = useState(cargo ? cargo.name : "");
  const [consolNumber, setConsolNumber] = useState(
    cargo ? cargo.consolNumber : ""
  );
  const [shipment, setShipment] = useState(cargo ? cargo.weight : "");
  const [mawb, setMawb] = useState(cargo ? cargo.destination : "");
  const [hawbs, setHawbs] = useState(cargo && cargo.hawbs ? cargo.hawbs : []); // HAWB# is now an array
  const [newHawb, setNewHawb] = useState(""); // State for adding a new HAWB#
  const [kllNumber, setKllNumber] = useState(cargo ? cargo.kllNumber : "");
  const [preAlertDate, setPreAlertDate] = useState(
    cargo ? cargo.preAlertDate : ""
  );
  const [eta, setEta] = useState(cargo ? cargo.eta : "");

  // Determine initial dropdown selection and custom status value
  const initialCurrentStatus =
    cargo && cargo.currentStatus === "Completed"
      ? "Completed"
      : "Other (specify)";
  const initialCustomStatus =
    cargo && cargo.currentStatus !== "Completed" ? cargo.currentStatus : "";

  const [currentStatus, setCurrentStatus] = useState(initialCurrentStatus);
  const [customStatus, setCustomStatus] = useState(initialCustomStatus);
  const [instructions, setInstructions] = useState(
    cargo ? cargo.instructions : ""
  ); // New state for instructions

  const handleAddHawb = () => {
    if (newHawb.trim() !== "") {
      setHawbs(prevHawbs => [...prevHawbs, newHawb.trim()]);
      setNewHawb("");
    }
  };

  const handleRemoveHawb = indexToRemove => {
    setHawbs(prevHawbs =>
      prevHawbs.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleSubmit = e => {
    e.preventDefault();
    let finalStatus;

    if (currentStatus === "Completed") {
      finalStatus = "Completed";
    } else {
      // currentStatus is 'Other (specify)'
      if (!customStatus) {
        setMessageBox({
          message: "Please specify the custom status.",
          type: "error",
        });
        return;
      }
      finalStatus = customStatus;
    }

    if (
      !consignee ||
      !consolNumber ||
      !shipment ||
      !mawb ||
      hawbs.length === 0 ||
      !kllNumber ||
      !preAlertDate ||
      !eta ||
      !finalStatus
    ) {
      setMessageBox({
        message:
          "Please fill in all required fields, including at least one HAWB#.",
        type: "error",
      });
      return;
    }

    const cargoData = {
      name: consignee,
      consolNumber: consolNumber,
      weight: shipment,
      destination: mawb,
      hawbs: hawbs, // Now an array of HAWB#s
      kllNumber: kllNumber,
      preAlertDate: preAlertDate,
      eta: eta,
      currentStatus: finalStatus,
      instructions: instructions,
    };

    if (cargo && cargo.id) {
      cargoData.id = cargo.id;
    }

    onSubmit(cargoData);
  };

  useEffect(() => {
    if (cargo) {
      if (cargo.currentStatus === "Completed") {
        setCurrentStatus("Completed");
        setCustomStatus("");
      } else {
        setCurrentStatus("Other (specify)");
        setCustomStatus(cargo.currentStatus);
      }
      setInstructions(cargo.instructions || "");
      setKllNumber(cargo.kllNumber || "");
      // Initialize hawbs from cargo.hawbs (new field) or cargo.status (old field)
      setHawbs(
        Array.isArray(cargo.hawbs)
          ? cargo.hawbs
          : cargo.status
          ? [cargo.status]
          : []
      );
    } else {
      setCurrentStatus("Other (specify)");
      setCustomStatus("");
      setInstructions("");
      setKllNumber("");
      setHawbs([]); // Initialize as empty array for new cargo
    }
    setNewHawb(""); // Clear newHawb input always
  }, [cargo]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
        {cargo ? "Edit Cargo" : "Add New Cargo"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="consignee"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Consignee
          </label>
          <input
            type="text"
            id="consignee"
            value={consignee}
            onChange={e => setConsignee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., John Doe Logistics"
            required
          />
        </div>
        {/* Consol# field */}
        <div>
          <label
            htmlFor="consolNumber"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Consol#
          </label>
          <input
            type="text"
            id="consolNumber"
            value={consolNumber}
            onChange={e => setConsolNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., CONSOL-XYZ"
            required
          />
        </div>
        <div>
          <label
            htmlFor="shipment"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Shipment#
          </label>
          <input
            type="text"
            id="shipment"
            value={shipment}
            onChange={e => setShipment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., SHIP-98765"
            required
          />
        </div>
        <div>
          <label
            htmlFor="mawb"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            MAWB#
          </label>
          <input
            type="text"
            id="mawb"
            value={mawb}
            onChange={e => setMawb(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., MAWB# 123-45678901"
            required
          />
        </div>
        {/* HAWB# input and list */}
        <div>
          <label
            htmlFor="newHawb"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            HAWB# (Add multiple)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="newHawb"
              value={newHawb}
              onChange={e => setNewHawb(e.target.value)}
              onKeyPress={e => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Prevent form submission
                  handleAddHawb();
                }
              }}
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter HAWB# and press Enter or Add"
            />
            <button
              type="button"
              onClick={handleAddHawb}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Add
            </button>
          </div>
          {hawbs.length > 0 && (
            <div className="mt-2 p-2 border border-gray-200 rounded-md bg-gray-50 max-h-24 overflow-y-auto">
              <ul className="list-disc list-inside text-sm text-gray-700">
                {hawbs.map((hawbItem, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center py-1"
                  >
                    {hawbItem}
                    <button
                      type="button"
                      onClick={() => handleRemoveHawb(index)}
                      className="ml-2 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"
                      aria-label={`Remove HAWB# ${hawbItem}`}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hawbs.length === 0 && (
            <p className="text-red-500 text-sm mt-1">
              At least one HAWB# is required.
            </p>
          )}
        </div>
        {/* KLL# field */}
        <div>
          <label
            htmlFor="kllNumber"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            KLL#
          </label>
          <input
            type="text"
            id="kllNumber"
            value={kllNumber}
            onChange={e => setKllNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., KLL-67890"
            required
          />
        </div>
        {/* Pre-Alert Date field */}
        <div>
          <label
            htmlFor="preAlertDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Pre-Alert Date
          </label>
          <input
            type="date"
            id="preAlertDate"
            value={preAlertDate}
            onChange={e => setPreAlertDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        {/* ETA field (now datetime-local) */}
        <div>
          <label
            htmlFor="eta"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            ETA
          </label>
          <input
            type="datetime-local"
            id="eta"
            value={eta}
            onChange={e => setEta(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        {/* Current Status field */}
        <div>
          <label
            htmlFor="currentStatus"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Current Status
          </label>
          <select
            id="currentStatus"
            value={currentStatus}
            onChange={e => {
              setCurrentStatus(e.target.value);
              // If 'Completed' is selected, clear custom status. Otherwise, keep it.
              if (e.target.value === "Completed") {
                setCustomStatus("");
              } else if (cargo && cargo.currentStatus !== "Completed") {
                // If switching back to 'Other (specify)' for existing cargo, restore its status
                setCustomStatus(cargo.currentStatus);
              } else {
                setCustomStatus(""); // For new cargo or if switching from 'Completed'
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Completed">Completed</option>
            <option value="Other (specify)">Other (specify)</option>
          </select>
        </div>
        {currentStatus === "Other (specify)" && (
          <div className="mt-4">
            <label
              htmlFor="customStatus"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Specify Other Status
            </label>
            <input
              type="text"
              id="customStatus"
              value={customStatus}
              onChange={e => setCustomStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., In Transit, Delivered, Awaiting Inspection"
              required
            />
          </div>
        )}
        {/* Instructions field */}
        <div className="mt-4">
          <label
            htmlFor="instructions"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Instructions
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any specific instructions here..."
          ></textarea>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-150 ease-in-out"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-md"
          >
            {cargo ? "Update Cargo" : "Add Cargo"}
          </button>
        </div>
      </form>
    </div>
  );
};

const CargoItem = ({ cargo, onEdit, onDelete }) => {
  const getStatusStyle = status => {
    if (status === "Completed") {
      return {
        backgroundColor: "#000000", // Black background
        color: "#FFFFFF", // White text
      };
    } else {
      return {
        backgroundColor: "#22C55E", // Green background
        color: "#000000", // Black text
      };
    }
  };

  // Function to format ETA for display
  const formatEtaDisplay = isoString => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return isoString;
      }
      return date.toLocaleString();
    } catch (e) {
      console.error("Error formatting ETA:", e);
      return isoString;
    }
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update current time every second

    return () => clearInterval(timer);
  }, []);

  // Determine if ETA should flash: starts at the beginning of ETA date and flashes until status is Completed
  const shouldFlashEta = () => {
    if (!cargo.eta) {
      return false;
    }

    try {
      const etaDate = new Date(cargo.eta);
      if (isNaN(etaDate.getTime())) {
        return false; // Invalid ETA date
      }

      // Get the start of the ETA's calendar day (00:00:00 of ETA date)
      const startOfEtaDay = new Date(
        etaDate.getFullYear(),
        etaDate.getMonth(),
        etaDate.getDate(),
        0,
        0,
        0,
        0
      );

      // Check if current time is on or after the start of the ETA's day
      const isEtaDayOrLater = currentTime.getTime() >= startOfEtaDay.getTime();

      // Flash if it's ETA day or later AND the status is NOT 'Completed'
      return isEtaDayOrLater && cargo.currentStatus !== "Completed";
    } catch (e) {
      console.error("Error parsing ETA for flashing logic:", e);
      return false;
    }
  };

  return (
    <div className="bg-white p-5 rounded-lg shadow-md flex flex-col md:flex-row items-start md:items-center justify-between transition-all duration-200 ease-in-out transform hover:scale-[1.01] hover:shadow-lg">
      <div className="flex-grow mb-4 md:mb-0">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center mb-3">
          <Package className="w-6 h-6 mr-2 text-blue-500" />
          <span>{cargo.name}</span> {/* Consignee */}
        </h3>

        {/* Section for Key Identifiers - All left-aligned and stacked */}
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            Consol#: <span className="font-medium">{cargo.consolNumber}</span>
          </div>
          <div>
            MAWB#: <span className="font-medium">{cargo.destination}</span>
          </div>
          <div>
            Shipment#: <span className="font-medium">{cargo.weight}</span>
          </div>
          <div>
            HAWB#:{" "}
            <span className="font-medium">
              {cargo.hawbs && cargo.hawbs.join(", ")}
            </span>
          </div>
          <div>
            KLL#: <span className="font-medium">{cargo.kllNumber}</span>
          </div>
          <div>
            Pre-Alert Date:{" "}
            <span className="font-medium">{cargo.preAlertDate}</span>
          </div>
          <div
            className={`${shouldFlashEta() ? "animate-flash-red" : ""} -ml-1`}
          >
            {" "}
            {/* Added -ml-1 here */}
            ETA:{" "}
            <span className="font-medium">{formatEtaDisplay(cargo.eta)}</span>
          </div>
        </div>

        <div
          style={getStatusStyle(cargo.currentStatus)}
          className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
        >
          <Truck className="w-3 h-3 mr-1" />
          {cargo.currentStatus}
        </div>

        {cargo.instructions && (
          <p className="text-gray-700 text-sm mt-2">
            <span className="font-semibold">Instructions:</span>{" "}
            {cargo.instructions}
          </p>
        )}
      </div>
      <div className="flex space-x-3">
        <button
          onClick={() => onEdit(cargo)}
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          aria-label="Edit cargo"
        >
          <Edit className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDelete(cargo.id)}
          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out shadow-sm"
          aria-label="Delete cargo"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const CargoList = ({
  cargoItems,
  onEdit,
  onDelete,
  searchQuery,
  filterCriterion,
}) => {
  const filteredItems = cargoItems.filter(item => {
    const query = searchQuery.toLowerCase();
    const itemData = {
      name: item.name?.toLowerCase() || "",
      consolNumber: item.consolNumber?.toLowerCase() || "",
      weight: item.weight?.toLowerCase() || "",
      destination: item.destination?.toLowerCase() || "",
      // Search across all HAWB#s
      hawbs: item.hawbs ? item.hawbs.map(h => h.toLowerCase()).join(" ") : "",
      kllNumber: item.kllNumber?.toLowerCase() || "",
      preAlertDate: item.preAlertDate?.toLowerCase() || "",
      eta: item.eta?.toLowerCase() || "",
      currentStatus: item.currentStatus?.toLowerCase() || "",
      instructions: item.instructions?.toLowerCase() || "",
    };

    if (filterCriterion && itemData[filterCriterion]) {
      return itemData[filterCriterion].includes(query);
    } else if (!filterCriterion) {
      // If no specific filter, search across all relevant fields
      return Object.values(itemData).some(value => value.includes(query));
    }
    return false;
  });

  if (filteredItems.length === 0 && searchQuery) {
    return (
      <p className="text-center text-gray-600 text-lg mt-8">
        No matching cargo found for "{searchQuery}".
      </p>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <p className="text-center text-gray-600 text-lg mt-8">
        No cargo items yet. Add one to get started!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredItems.map(cargo => (
        <CargoItem
          key={cargo.id}
          cargo={cargo}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

const AuthStatus = ({ userId }) => (
  <div className="bg-gray-800 text-white p-3 text-sm rounded-b-lg shadow-md flex items-center justify-center">
    <span className="font-semibold mr-2">User ID:</span>
    <span className="break-all">{userId || "Authenticating..."}</span>
  </div>
);

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [cargoItems, setCargoItems] = useState([]);
  const [view, setView] = useState("list"); // 'list', 'add', 'edit'
  const [editingCargo, setEditingCargo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageBox, setMessageBox] = useState({
    message: "",
    type: "",
    onConfirm: null,
  });
  const [isLoading, setIsLoading] = useState(true); // New loading state
  const [filterCriterion, setFilterCriterion] = useState(""); // New state for filter criterion

  // Firebase Initialization and Auth
  useEffect(() => {
    try {
      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing or empty.");
        setMessageBox({
          message:
            "Firebase configuration is missing. Please ensure the app is configured correctly.",
          type: "error",
        });
        setIsLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async user => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Sign in anonymously if no user is found and no custom token is provided

          try {
            const anonUser = await signInAnonymously(firebaseAuth);
            setUserId(anonUser.user.uid);
          } catch (error) {
            console.error("Error signing in anonymously:", error);
            setMessageBox({
              message: `Authentication failed: ${error.message}`,
              type: "error",
            });
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setMessageBox({
        message: `Failed to initialize Firebase: ${error.message}`,
        type: "error",
      });
      setIsLoading(false);
    }
  }, []);

  // Fetch cargo items when auth is ready and db is available
  useEffect(() => {
    if (db && isAuthReady && userId) {
      const cargoCollectionRef = collection(
        db,
        `artifacts/${appId}/public/data/cargoItems`
      );

      // Use onSnapshot for real-time updates
      const unsubscribe = onSnapshot(
        cargoCollectionRef,
        snapshot => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Ensure hawbs is always an array, handling old string 'status' field
          const processedItems = items.map(item => ({
            ...item,
            hawbs: Array.isArray(item.hawbs)
              ? item.hawbs
              : item.status
              ? [item.status]
              : [],
          }));
          // Sort items by a relevant field, e.g., name or creation time if available
          processedItems.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          setCargoItems(processedItems);
          setIsLoading(false); // Data loaded
        },
        error => {
          console.error("Error fetching cargo items:", error);
          setMessageBox({
            message: `Failed to load cargo items: ${error.message}`,
            type: "error",
          });
          setIsLoading(false);
        }
      );

      return () => unsubscribe(); // Cleanup listener on unmount
    } else if (isAuthReady && !userId) {
      // If auth is ready but no userId (e.g., anonymous sign-in failed), stop loading
      setIsLoading(false);
    }
  }, [db, isAuthReady, userId]);

  const handleAddCargo = async newCargo => {
    if (!db || !userId) {
      setMessageBox({
        message: "Database not ready or user not authenticated.",
        type: "error",
      });
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(
        collection(db, `artifacts/${appId}/public/data/cargoItems`),
        {
          ...newCargo,
          userId: userId, // Store the user who added it
          createdAt: new Date().toISOString(), // Add a timestamp
        }
      );
      setMessageBox({ message: "Cargo added successfully!", type: "success" });
      setView("list");
    } catch (e) {
      console.error("Error adding document: ", e);
      setMessageBox({
        message: `Error adding cargo: ${e.message}`,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCargo = async updatedCargo => {
    if (!db || !userId) {
      setMessageBox({
        message: "Database not ready or user not authenticated.",
        type: "error",
      });
      return;
    }
    // Added a check for updatedCargo.id to prevent the error
    if (!updatedCargo.id) {
      console.error(
        "Error: updatedCargo.id is undefined. Cannot update document."
      );
      setMessageBox({
        message: "Error: Cannot update cargo. Missing ID.",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      const cargoRef = doc(
        db,
        `artifacts/${appId}/public/data/cargoItems`,
        updatedCargo.id
      );
      // Destructure to remove 'status' if it exists, as 'hawbs' is the new field
      const { status, ...dataToUpdate } = updatedCargo;
      await updateDoc(cargoRef, {
        ...dataToUpdate, // Use the rest of the cargo data
        updatedAt: new Date().toISOString(),
      });
      setMessageBox({
        message: "Cargo updated successfully!",
        type: "success",
      });
      setView("list");
      setEditingCargo(null);
    } catch (e) {
      console.error("Error updating document: ", e);
      setMessageBox({
        message: `Error updating cargo: ${e.message}`,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCargo = id => {
    setMessageBox({
      message: "Are you sure you want to delete this cargo item?",
      type: "confirm",
      onConfirm: async () => {
        if (!db || !userId) {
          setMessageBox({
            message: "Database not ready or user not authenticated.",
            type: "error",
          });
          return;
        }
        setIsLoading(true);
        try {
          await deleteDoc(
            doc(db, `artifacts/${appId}/public/data/cargoItems`, id)
          );
          setMessageBox({
            message: "Cargo deleted successfully!",
            type: "success",
          });
        } catch (e) {
          console.error("Error deleting document: ", e);
          setMessageBox({
            message: `Error deleting cargo: ${e.message}`,
            type: "error",
          });
        } finally {
          setIsLoading(false);
        }
        setMessageBox({ message: "", type: "" }); // Close confirm box
      },
    });
  };

  const closeMessageBox = () => {
    setMessageBox({ message: "", type: "", onConfirm: null });
  };

  return (
    <AppContext.Provider value={{ db, auth, userId }}>
      <div className="min-h-screen bg-gray-50 font-inter antialiased flex flex-col">
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; }

            /* Keyframes for flashing effect (dark red) */
            @keyframes flash-red {
              0% { background-color: transparent; }
              50% { background-color: #ef4444; } /* Tailwind red-500, a darker red */
              100% { background-color: transparent; }
            }

            .animate-flash-red {
              animation: flash-red 1s infinite alternate;
              padding: 2px 4px;
              border-radius: 4px;
            }
          `}
        </style>

        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg rounded-b-lg">
          <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
            <h1 className="text-3xl font-extrabold flex items-center mb-3 md:mb-0">
              <Truck className="w-8 h-8 mr-3" />
              Coordinator Cargo App
            </h1>
            <div className="flex items-center space-x-4 w-full md:w-auto">
              {view === "list" && (
                <>
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      placeholder="Search cargo..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-full bg-blue-700 bg-opacity-30 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-blue-800 focus:bg-opacity-50 transition duration-200"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-200 w-5 h-5" />
                  </div>
                  <select
                    value={filterCriterion}
                    onChange={e => setFilterCriterion(e.target.value)}
                    className="ml-2 px-3 py-2 rounded-full bg-blue-700 bg-opacity-30 text-white border border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-blue-800 focus:bg-opacity-50 transition duration-200"
                  >
                    <option value="">All Fields</option>
                    <option value="name">Consignee</option>
                    <option value="consolNumber">Consol#</option>
                    <option value="weight">Shipment#</option>
                    <option value="destination">MAWB#</option>
                    <option value="hawbs">HAWB#</option>{" "}
                    {/* Updated filter option to hawbs */}
                    <option value="kllNumber">KLL#</option>
                    <option value="preAlertDate">Pre-Alert Date</option>
                    <option value="eta">ETA</option>
                    <option value="currentStatus">Current Status</option>
                    <option value="instructions">Instructions</option>
                  </select>
                </>
              )}
              <button
                onClick={() => setView("add")}
                className="flex items-center px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-md transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Add Cargo
              </button>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-6 flex-grow">
          {isLoading && <LoadingSpinner />}

          {!isLoading && view === "list" && (
            <div className="mt-8">
              <CargoList
                cargoItems={cargoItems}
                onEdit={cargo => {
                  setEditingCargo(cargo);
                  setView("edit");
                }}
                onDelete={handleDeleteCargo}
                searchQuery={searchQuery}
                filterCriterion={filterCriterion}
              />
            </div>
          )}

          {!isLoading && view === "add" && (
            <div className="mt-8">
              <CargoForm
                onSubmit={handleAddCargo}
                onCancel={() => setView("list")}
                setMessageBox={setMessageBox}
              />{" "}
              {/* Pass setMessageBox */}
            </div>
          )}

          {!isLoading && view === "edit" && editingCargo && (
            <div className="mt-8">
              <CargoForm
                cargo={editingCargo}
                onSubmit={handleUpdateCargo}
                onCancel={() => {
                  setView("list");
                  setEditingCargo(null);
                }}
                setMessageBox={setMessageBox}
              />{" "}
              {/* Pass setMessageBox */}
            </div>
          )}
        </main>

        <AuthStatus userId={userId} />

        <MessageBox
          message={messageBox.message}
          type={messageBox.type}
          onClose={closeMessageBox}
          onConfirm={messageBox.onConfirm}
        />
      </div>
    </AppContext.Provider>
  );
}

export default App;
